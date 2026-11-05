import { getRpcRendererUrl, isRpcRendererUrl } from "@/main/rpc/sender";
import { upsertUserProfile } from "@/services/user-profile";
import { BrowserWindow, ipcMain } from "electron";
import {
  openAuthView,
  closeAuthView,
  registerAuthViewIpc,
} from "@/main/services/auth-view";
import type {
  AuthCommand,
  AuthData,
  AuthResult,
  AuthSnapshot,
  GameAccount,
} from "@/utils/interface";
import { emptyAuthData, offlineUuid, username } from "@/lib/auth/model";
import { readVault, writeVault, vaultExists } from "@/lib/auth/vault";
import {
  gorthSnapshot,
  getGorthUserId,
  loginGorth,
  restoreGorthSession,
  signOutGorth,
  onGorthChanged,
} from "@/lib/auth/gorth";
import { elyBinding } from "@/lib/auth/ely";
import {
  gameBinding,
  fetchNativeGameProfile,
  issueNativeGameSession,
} from "@/lib/auth/gorth-game";
import { AuthHttpError } from "@/lib/auth/http";
import { getLoginBrowser, setLoginBrowser } from "@/lib/auth/login-browser";

let data: AuthData = emptyAuthData();
let loaded: Promise<void> | undefined;
let unlocked = false;
let pending: AuthSnapshot["pending"] = null;
let operation: AbortController | null = null;
let gameWarning: string | null = null;

function load() {
  return (loaded ??= (async () => {
    try {
      data = await readVault();
      unlocked = true;
    } catch (error) {
      loaded = undefined;
      throw error;
    }
  })());
}
function expectedBinding(account: GameAccount) {
  return account.provider === "ely" ? elyBinding() : gameBinding();
}
function snapshot(): AuthSnapshot {
  return {
    loginBrowser: getLoginBrowser(),
    gameWarning,
    locked:
      gorthSnapshot().locked ||
      (!gorthSnapshot().user && !unlocked && vaultExists()),
    launcher: gorthSnapshot().user,
    accounts: data.accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      username: a.username,
      image:
        a.provider === "gorth" && a.ownerId === getGorthUserId()
          ? gorthSnapshot().user?.image
          : undefined,
      uuid: a.uuid,
      expiresAt: a.tokens?.expiresAt ?? null,
      needsLogin:
        a.provider === "gorth"
          ? !getGorthUserId() || a.ownerId !== getGorthUserId()
          : a.provider !== "offline" &&
            (!a.tokens ||
              a.tokens.expiresAt <= Date.now() ||
              a.tokens.binding !== expectedBinding(a)),
    })),
    selectedAccountId: data.selectedAccountId,
    pending,
    providers: {
      gorthLauncher: gorthSnapshot().configured,
      ely: false,
      gorthGame: gorthSnapshot().configured,
    },
  };
}
function changed() {
  for (const window of BrowserWindow.getAllWindows())
    if (!window.webContents.isDestroyed())
      window.webContents.send("auth:changed", snapshot());
}
async function save(next: AuthData) {
  await writeVault(next);
  data = next;
  changed();
}
async function upsert(account: GameAccount) {
  await save({
    ...data,
    accounts: [...data.accounts.filter((a) => a.id !== account.id), account],
    selectedAccountId: data.selectedAccountId ?? account.id,
  });
}
async function syncNativeGameProfile(signal: AbortSignal) {
  if (!getGorthUserId()) return;
  try {
    await load();
    const profile = await fetchNativeGameProfile(signal);
    signal.throwIfAborted();
    if (!profile) {
      gameWarning =
        "Tạo tên Minecraft tại trang Profile của website Launcher trước khi chơi trực tuyến.";
      return;
    }
    await upsert(profile);
    gameWarning = null;
  } catch (error) {
    signal.throwIfAborted();
    gameWarning =
      "SSO đã đăng nhập. Hồ sơ game chưa sẵn sàng; kiểm tra kết nối và migration website, rồi làm mới phiên.";
    console.warn("[minecraft/profile]", {
      status: error instanceof AuthHttpError ? error.status : undefined,
    });
  }
}
function command(value: unknown): AuthCommand {
  if (!value || typeof value !== "object")
    throw new Error("Yêu cầu auth không hợp lệ.");
  const c = value as Record<string, unknown>;
  if (c.action === "offline.add" && typeof c.username === "string")
    return { action: c.action, username: c.username };
  if (
    ["game.select", "game.remove", "game.refresh"].includes(String(c.action)) &&
    typeof c.id === "string" &&
    c.id.length <= 100
  )
    return { action: c.action, id: c.id } as AuthCommand;
  if (
    c.action === "gorth.game.login" &&
    typeof c.username === "string" &&
    typeof c.password === "string"
  )
    return { action: c.action, username: c.username, password: c.password };
  if (
    [
      "launcher.login",
      "launcher.register",
      "launcher.unlock",
      "launcher.logout",
      "launcher.refresh",
      "ely.login",
      "cancel",
    ].includes(String(c.action))
  )
    return { action: c.action } as AuthCommand;
  throw new Error("Yêu cầu auth không hợp lệ.");
}
function publicError(error: unknown) {
  if (error instanceof AuthHttpError) {
    if (error.code === "invalid_grant" || error.status === 401)
      return "Phiên đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.code === "access_denied") return "Đăng nhập bị từ chối.";
    if (error.code === "invalid_client")
      return "Client ID chưa đăng ký hoặc chưa được bật cho luồng đăng nhập này.";
    return "Dịch vụ xác thực từ chối yêu cầu. Kiểm tra cấu hình hoặc đăng nhập lại.";
  }
  if (error instanceof Error && /[À-ỹ]/u.test(error.message))
    return error.message;
  return "Không thể hoàn tất xác thực. Kiểm tra kết nối và cấu hình nhà cung cấp.";
}
async function refreshAccount(account: GameAccount, signal: AbortSignal) {
  signal.throwIfAborted();
  if (account.provider === "gorth") {
    await restoreGorthSession(signal);
    if (account.ownerId && account.ownerId !== getGorthUserId())
      throw new Error(
        "Hãy đăng nhập đúng tài khoản Gorth SSO sở hữu hồ sơ game này.",
      );
    const next = await issueNativeGameSession(signal);
    if (
      next.uuid !== account.uuid ||
      (account.ownerId && next.ownerId !== account.ownerId)
    )
      throw new Error(
        "Hồ sơ Minecraft không khớp tài khoản Gorth SSO hiện tại.",
      );
    return next;
  }
  if (account.provider !== "offline")
    throw new Error(
      "Online game accounts are not enabled yet. Use an offline profile.",
    );
  return account;
}
async function execute(
  raw: unknown,
  owner: BrowserWindow,
): Promise<AuthResult> {
  let ownOperation: AbortController | null = null;
  let completed = false;
  let c: AuthCommand | undefined;
  try {
    c = command(raw);
    if (c.action === "ely.login" || c.action === "gorth.game.login")
      throw new Error("Hiện tại chỉ hỗ trợ đăng nhập Gorth SSO.");
    if (c.action === "cancel") {
      operation?.abort();
      return { ok: true, snapshot: snapshot() };
    }
    if (operation)
      throw new Error(
        "Một thao tác tài khoản đang chạy. Hãy hủy hoặc chờ hoàn tất.",
      );
    ownOperation = new AbortController();
    operation = ownOperation;
    const signal = ownOperation.signal;
    if (
      ![
        "launcher.login",
        "launcher.register",
        "launcher.logout",
        "launcher.refresh",
      ].includes(c.action)
    )
      await load();
    signal.throwIfAborted();
    if (c.action === "launcher.unlock") {
      if (gorthSnapshot().configured) await restoreGorthSession(signal);
      const user = gorthSnapshot().user;
      if (user) upsertUserProfile(user);
      await syncNativeGameProfile(signal);
      return { ok: true, snapshot: snapshot() };
    }
    switch (c.action) {
      case "offline.add": {
        const name = username(c.username.trim());
        const uuid = offlineUuid(name);
        if (
          data.accounts.some(
            (a) =>
              a.provider === "offline" &&
              a.username.toLowerCase() === name.toLowerCase(),
          )
        )
          throw new Error("Tài khoản Offline đã tồn tại.");
        await upsert({
          id: "offline:" + uuid,
          provider: "offline",
          username: name,
          uuid,
        });
        break;
      }
      case "game.select":
      case "game.remove":
      case "game.refresh": {
        const id = c.id;
        const account = data.accounts.find((a) => a.id === id);
        if (!account) throw new Error("Không tìm thấy tài khoản game.");
        if (c.action === "game.select")
          await save({ ...data, selectedAccountId: account.id });
        else if (c.action === "game.remove") {
          const accounts = data.accounts.filter((a) => a.id !== account.id);
          await save({
            ...data,
            accounts,
            selectedAccountId:
              data.selectedAccountId === account.id
                ? (accounts[0]?.id ?? null)
                : data.selectedAccountId,
          });
        } else await upsert(await refreshAccount(account, signal));
        break;
      }
      case "launcher.login":
      case "launcher.register": {
        const mode = c.action === "launcher.register" ? "register" : "login";
        pending = {
          provider: "gorth",
          expiresAt: Date.now() + 120_000,
        };
        changed();
        openAuthView(owner, ownOperation!, mode);
        await loginGorth(signal);
        signal.throwIfAborted();
        const user = gorthSnapshot().user;
        if (user) upsertUserProfile(user);
        await syncNativeGameProfile(signal);
        completed = true;
        break;
      }
      case "launcher.logout":
        gameWarning = null;
        await signOutGorth();
        break;
      case "launcher.refresh": {
        // Automatic 401 retries must not unlock a saved session on startup.
        const session = gorthSnapshot();
        if (session.locked || !session.user)
          throw new Error(
            "Hãy đăng nhập hoặc mở khóa phiên Gorth trước khi làm mới.",
          );
        await restoreGorthSession(signal);
        const user = gorthSnapshot().user;
        if (user) upsertUserProfile(user);
        await syncNativeGameProfile(signal);
        break;
      }
    }
    return { ok: true, snapshot: { ...snapshot(), pending: null } };
  } catch (error) {
    if (
      ownOperation &&
      c?.action === "game.refresh" &&
      error instanceof AuthHttpError &&
      (["invalid_grant", "invalid_token"].includes(error.code) ||
        [401, 403].includes(error.status))
    ) {
      const id = c.id;
      await save({
        ...data,
        accounts: data.accounts.map((a) =>
          a.id === id ? { ...a, tokens: undefined } : a,
        ),
      });
    }
    return {
      ok: false,
      error: ownOperation?.signal.aborted
        ? "Đã hủy đăng nhập."
        : publicError(error),
      snapshot: { ...snapshot(), ...(ownOperation ? { pending: null } : {}) },
    };
  } finally {
    if (ownOperation && operation === ownOperation) {
      closeAuthView(owner, completed);
      operation = null;
      pending = null;
      changed();
    }
  }
}
export function registerAuthIpc() {
  const trusted = (event: Electron.IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (
      !window ||
      window.webContents !== event.sender ||
      event.senderFrame !== event.sender.mainFrame ||
      !event.senderFrame ||
      !isRpcRendererUrl(event.senderFrame.url, getRpcRendererUrl())
    )
      throw new Error("Untrusted auth sender");
    return window;
  };
  onGorthChanged(changed);
  registerAuthViewIpc(trusted);
  ipcMain.handle("auth:login-browser", (event, value: unknown): AuthResult => {
    trusted(event);
    try {
      if (operation)
        throw new Error("An account operation is already running.");
      setLoginBrowser(value);
      changed();
      return { ok: true, snapshot: snapshot() };
    } catch {
      return {
        ok: false,
        snapshot: snapshot(),
        error: "Không thể lưu trình duyệt đăng nhập.",
      };
    }
  });
  ipcMain.handle("auth:snapshot", async (event) => {
    trusted(event);
    try {
      return { ok: true, snapshot: snapshot() };
    } catch {
      return {
        ok: false,
        error: "Không mở được kho tài khoản. Dữ liệu được giữ nguyên.",
        snapshot: snapshot(),
      };
    }
  });
  ipcMain.handle("auth:command", async (event, value: unknown) => {
    const owner = trusted(event);
    return execute(value, owner);
  });
}
export function cancelAuth() {
  operation?.abort();
}
// Main-process-only launch credential. Never expose this over IPC.
export async function resolveGameSession(accountId?: string | null) {
  await load();
  if (operation) throw new Error("Tài khoản đang được cập nhật.");
  const ownOperation = new AbortController();
  operation = ownOperation;
  try {
    let account = data.accounts.find(
      (a) => a.id === (accountId || data.selectedAccountId),
    );
    if (!account && !accountId && gorthSnapshot().user) {
      await restoreGorthSession(ownOperation.signal);
      const profile = await fetchNativeGameProfile(ownOperation.signal);
      ownOperation.signal.throwIfAborted();
      if (profile) {
        account = profile;
        await upsert(profile);
      }
    }
    if (!account)
      throw new Error(
        "Chọn tài khoản game hoặc tạo hồ sơ Minecraft trên website trước khi chơi.",
      );
    if (account.provider === "offline")
      return {
        username: account.username,
        uuid: account.uuid,
        accessToken: "0",
        authlibRoot: null,
      };
    if (account.provider === "gorth") {
      const next = await refreshAccount(account, ownOperation.signal);
      ownOperation.signal.throwIfAborted();
      await upsert(next);
      if (!next.tokens) throw new Error("Không cấp được phiên Minecraft.");
      return {
        username: next.username,
        uuid: next.uuid,
        accessToken: next.tokens.accessToken,
        authlibRoot: next.tokens.binding,
      };
    }
    throw new Error(
      "Online game accounts are not enabled yet. Use an offline profile.",
    );
  } finally {
    if (operation === ownOperation) operation = null;
    changed();
  }
}

export function getAuthenticatedUserId() {
  return getGorthUserId();
}
