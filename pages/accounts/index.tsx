import { confirmAction } from "@/lib/confirmation";
import { PageHeading } from "@/components/heading";
import { UserRound as PageIcon } from "@gorth-com/primitive/cores/lucide";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { PageShell } from "@/layouts/page-shell";
import { PageBanner } from "@/components/element/page-banner";
import { NavIdentity } from "@/components/dashboard/nav-identity";
import { Badge } from "@gorth-com/primitive/custom/badge";
import accountsBackground from "@/public/dawn/accounts.png";
import { useForm } from "@gorth-com/primitive/cores/tanstack/form";
import {
  Check,
  User,
  UserPlus,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  Trash2,
} from "@gorth-com/primitive/cores/lucide";
import { Button } from "@gorth-com/primitive/custom/button";
import { Input } from "@gorth-com/primitive/default/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@gorth-com/primitive/default/card";
import type { useAuth } from "@/hooks/use-auth";

export function AccountsPage({ auth, busy, run }: ReturnType<typeof useAuth>) {
  useFeedbackToast(
    auth && !auth.providers.gorthLauncher
      ? "Đăng nhập Gorth chưa được cấu hình cho bản launcher này."
      : undefined,
  );
  const offlineForm = useForm({
    defaultValues: { username: "" },
    onSubmit: async ({ value }) => {
      if (await run({ action: "offline.add", username: value.username }))
        offlineForm.reset();
    },
  });
  if (!auth) return <p role="status">{"Đang đọc tài khoản…"}</p>;
  return (
    <div className="flex flex-col gap-6" data-page-url="gorth://accounts">
      <PageShell
        heading={<PageHeading icon={PageIcon} title="Accounts" />}
        aside={
          <>
            <Card>
              <CardHeader className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Gorth account</CardTitle>
                  <Badge
                    variant={
                      busy || auth.pending
                        ? "secondary"
                        : auth.launcher &&
                            !auth.launcher.needsLogin &&
                            !auth.locked
                          ? "default"
                          : "outline"
                    }
                  >
                    {busy || auth.pending
                      ? "syncing"
                      : auth.launcher &&
                          !auth.launcher.needsLogin &&
                          !auth.locked
                        ? "synced"
                        : "unsynced"}
                  </Badge>
                </div>
                <NavIdentity
                  user={{
                    name: auth.launcher?.name ?? "Personal",
                    email: auth.launcher
                      ? (auth.launcher.email ?? "")
                      : "local",
                    avatar: auth.launcher?.image ?? "",
                  }}
                  icon={auth.launcher ? undefined : User}
                />
              </CardHeader>
              <CardContent className="flex flex-col gap-4 p-4">
                {auth.launcher ? (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex gap-2">
                      <Button
                        className="h-9"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void run({ action: "launcher.refresh" })}
                      >
                        <RefreshCw />
                        Refresh
                      </Button>
                      <Button
                        className="h-9"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void run({ action: "launcher.logout" })}
                      >
                        <LogOut />
                        Sign out
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Bạn chưa đăng nhập launcher. Hồ sơ Offline vẫn có thể được
                    tạo trên thiết bị.
                  </p>
                )}
                <Button
                  className="h-9"
                  disabled={busy || !auth.providers.gorthLauncher}
                  onClick={() => void run({ action: "launcher.login" })}
                >
                  <LogIn />
                  {auth.launcher ? "Switch" : "Sign in"}
                </Button>
                {!auth.launcher && (
                  <Button
                    className="h-9"
                    variant="outline"
                    disabled={busy || !auth.providers.gorthLauncher}
                    onClick={() => void run({ action: "launcher.register" })}
                  >
                    <UserPlus /> Sign up
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Đăng xuất xóa phiên trên thiết bị và thu hồi token của
                  launcher, không xóa tài khoản game hoặc phiên SSO trong trình
                  duyệt.
                </p>
              </CardContent>
            </Card>{" "}
            <Card>
              <CardHeader>
                <CardTitle>Offline</CardTitle>
                <CardDescription>
                  Chơi đơn hoặc trên server cho phép tài khoản Offline.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void offlineForm.handleSubmit();
                  }}
                  className="flex flex-wrap items-end gap-3"
                >
                  <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                    Tên Minecraft
                    <offlineForm.Field name="username">
                      {(field) => (
                        <Input
                          className="h-9"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          minLength={3}
                          maxLength={16}
                          pattern="[A-Za-z0-9_]{3,16}"
                          required
                          placeholder="Player"
                        />
                      )}
                    </offlineForm.Field>
                  </label>
                  <Button type="submit" className="h-9" disabled={busy}>
                    Thêm Offline
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        }
      >
        {auth.locked && (
          <Card>
            <CardHeader>
              <CardTitle>Phiên đã lưu</CardTitle>
              <CardDescription>
                Không thể tự mở phiên đã lưu. Cấp quyền Keychain rồi thử lại.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                disabled={busy}
                onClick={() => void run({ action: "launcher.unlock" })}
              >
                Mở khóa phiên Gorth
              </Button>
            </CardContent>
          </Card>
        )}
        {auth.pending && (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <p role="status" className="flex items-center gap-2 text-sm">
                <LoaderCircle className="size-4 animate-spin" />
                Đang xác thực Gorth trong cửa sổ này…
              </p>
              <Button
                className="h-9"
                variant="outline"
                onClick={() => void run({ action: "cancel" })}
              >
                Hủy đăng nhập
              </Button>
            </CardContent>
          </Card>
        )}
        <PageBanner image={accountsBackground} />

        <Card>
          <CardHeader>
            <CardTitle>Tài khoản game</CardTitle>
            <CardDescription>
              Tài khoản được chọn sẽ dùng khi nhấn Chơi Minecraft trong thư
              viện.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-2">
            {!auth.accounts.length && (
              <p className="py-4 text-sm text-muted-foreground">
                Chưa có tài khoản game. Tạo tên Minecraft trên website Launcher
                rồi làm mới phiên, hoặc thêm hồ sơ Offline.
              </p>
            )}
            {auth.accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <NavIdentity
                  user={{
                    name: account.username,
                    email: "",
                    avatar: account.image ?? "",
                  }}
                  description={
                    account.provider === "offline"
                      ? "Local"
                      : account.provider === "ely"
                        ? "Ely"
                        : "Gorth"
                  }
                  badge={
                    <Badge variant="secondary">
                      {account.provider === "offline" || account.needsLogin
                        ? "Offline"
                        : "Online"}
                    </Badge>
                  }
                />
                <div className="flex gap-2">
                  <Button
                    className="h-9"
                    variant={
                      auth.selectedAccountId === account.id
                        ? "secondary"
                        : "outline"
                    }
                    disabled={busy || auth.selectedAccountId === account.id}
                    onClick={() =>
                      void run({ action: "game.select", id: account.id })
                    }
                  >
                    {auth.selectedAccountId === account.id && <Check />}
                    {auth.selectedAccountId === account.id
                      ? "Đang chọn"
                      : "Sử dụng"}
                  </Button>
                  {account.provider !== "offline" && (
                    <Button
                      className="h-9"
                      variant="outline"
                      size="icon"
                      aria-label={"Làm mới " + account.username}
                      disabled={busy}
                      onClick={() =>
                        void run({ action: "game.refresh", id: account.id })
                      }
                    >
                      <RefreshCw />
                    </Button>
                  )}
                  <Button
                    className="h-9"
                    variant="destructive"
                    size="icon"
                    aria-label={"Xóa " + account.username}
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await confirmAction(
                          "Xóa tài khoản game " +
                            account.username +
                            " khỏi thiết bị?",
                        )
                      )
                        void run({ action: "game.remove", id: account.id });
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </PageShell>
    </div>
  );
}
