import type { AutoUpdater } from "electron";
import type { UpdateState } from "@/lib/update/interface";
import {
  isNewerRelease,
  parseRelease,
  releaseVersion,
} from "@/lib/update/release";

interface UpdateOptions {
  version: string;
  owner: string;
  repository: string;
  platform: string;
  arch: string;
  disabledReason?: string;
  driver: Pick<
    AutoUpdater,
    "setFeedURL" | "checkForUpdates" | "quitAndInstall"
  > &
    Pick<NodeJS.EventEmitter, "on" | "removeListener">;
  fetch: typeof fetch;
  confirmInstall: () => Promise<boolean>;
}
export function createUpdateController(options: UpdateOptions) {
  if (
    !/^[A-Za-z0-9_.-]+$/.test(options.owner) ||
    !/^[A-Za-z0-9_.-]+$/.test(options.repository)
  )
    throw new Error("Invalid release repository");
  const { driver } = options;
  const base =
    "https://api.github.com/repos/" + options.owner + "/" + options.repository;
  let state: UpdateState = {
    version: options.version,
    status: options.disabledReason ? "disabled" : "idle",
    message: options.disabledReason ?? "Sẵn sàng kiểm tra cập nhật.",
  };
  const listeners = new Set<(state: UpdateState) => void>();
  let checking: Promise<UpdateState> | undefined;
  let nativeBusy = false,
    installing = false,
    disposed = false;
  const snapshot = () => ({ ...state });
  function publish(change: Partial<UpdateState>) {
    if (disposed) return snapshot();
    state = { ...state, ...change };
    for (const listener of listeners) listener(snapshot());
    return snapshot();
  }
  async function check() {
    if (
      disposed ||
      state.status === "disabled" ||
      nativeBusy ||
      installing ||
      state.status === "installing" ||
      state.status === "downloaded"
    )
      return snapshot();
    if (checking) return checking;
    async function perform() {
      publish({
        status: "checking",
        availableVersion: undefined,
        message: "Đang kiểm tra GitHub Releases…",
      });
      try {
        const response = await options.fetch(base + "/releases/latest", {
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: AbortSignal.timeout(15_000),
          redirect: "error",
        });
        if (!response.ok) throw new Error("Release endpoint unavailable");
        const text = await response.text();
        if (text.length > 1_048_576)
          throw new Error("Release metadata too large");
        const version = parseRelease(
          JSON.parse(text),
          options.platform,
          options.arch,
        );
        return publish(
          isNewerRelease(version, options.version)
            ? {
                status: "available",
                availableVersion: version,
                message: "Có phiên bản mới. Chưa tải xuống.",
              }
            : {
                status: "current",
                availableVersion: undefined,
                message: "Bạn đang dùng phiên bản mới nhất.",
              },
        );
      } catch {
        return publish({
          status: "error",
          message:
            "Không kiểm tra được bản phát hành phù hợp. Kiểm tra mạng, repo public và các file release rồi thử lại.",
        });
      }
    }
    checking = perform();
    try {
      return await checking;
    } finally {
      checking = undefined;
    }
  }
  function download() {
    if (state.status !== "available" || nativeBusy || disposed)
      return snapshot();
    nativeBusy = true;
    publish({
      status: "downloading",
      message: "Đang tải bản cập nhật. Electron sẽ xác minh gói cài đặt…",
    });
    try {
      driver.setFeedURL({
        url:
          "https://update.electronjs.org/" +
          options.owner +
          "/" +
          options.repository +
          "/" +
          options.platform +
          "-" +
          options.arch +
          "/" +
          encodeURIComponent(options.version),
      });
      driver.checkForUpdates();
    } catch {
      failed();
    }
    return snapshot();
  }
  function failed() {
    if (!nativeBusy) return;
    nativeBusy = false;
    publish({
      status: "error",
      message:
        "Không tải hoặc xác minh được bản cập nhật. Hãy kiểm tra kết nối và chữ ký ứng dụng rồi thử lại.",
    });
  }
  function downloaded(_event: unknown, _notes: string, name: string) {
    if (!nativeBusy) return;
    nativeBusy = false;
    publish({
      status: "downloaded",
      availableVersion: releaseVersion(name) ?? state.availableVersion,
      message: "Đã tải xong. Lưu công việc trước khi khởi động lại.",
    });
  }
  function unavailable() {
    if (!nativeBusy) return;
    nativeBusy = false;
    publish({
      status: "current",
      availableVersion: undefined,
      message:
        "Dịch vụ cập nhật chưa có gói mới phù hợp. Hãy kiểm tra lại sau.",
    });
  }
  async function install() {
    if (state.status !== "downloaded" || installing || disposed)
      return snapshot();
    installing = true;
    try {
      if (!(await options.confirmInstall())) return snapshot();
      publish({
        status: "installing",
        message: "Đang khởi động lại để cập nhật…",
      });
      driver.quitAndInstall();
    } catch {
      publish({
        status: "downloaded",
        message:
          "Chưa thể khởi động lại. Hãy đóng tác vụ đang chạy, lưu công việc rồi thử lại.",
      });
    } finally {
      installing = false;
    }
    return snapshot();
  }
  if (!options.disabledReason) {
    driver.on("error", failed);
    driver.on("update-downloaded", downloaded);
    driver.on("update-not-available", unavailable);
  }
  return {
    snapshot,
    check,
    download,
    install,
    subscribe(listener: (state: UpdateState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      listeners.clear();
      if (!options.disabledReason) {
        driver.removeListener("error", failed);
        driver.removeListener("update-downloaded", downloaded);
        driver.removeListener("update-not-available", unavailable);
      }
    },
  };
}
