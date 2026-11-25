import type { ReactNode } from "react";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { NavIdentity } from "@/components/dashboard/nav-identity";
import { Badge } from "@gorth-com/primitive/custom/badge";
import {
  User,
  LogIn,
  UserPlus,
  RefreshCw,
  LogOut,
  Unlock,
  X,
} from "@gorth-com/primitive/cores/lucide";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@gorth-com/primitive/default/card";
import { Separator } from "@gorth-com/primitive/default/separator";

export function AccountCard({
  children,
  profileName = "Personal",
}: {
  children?: ReactNode;
  profileName?: string;
}) {
  const { auth, error, busy, loading, authenticated, run: command } = useAuth();
  const state = auth
    ? {
        user: auth.launcher,
        configured: auth.providers.gorthLauncher,
        locked: auth.locked,
      }
    : undefined;
  useFeedbackToast(error);
  useFeedbackToast(
    state && !state.configured ? "Gorth sign-in is not configured." : undefined,
  );
  const run = (
    action: "login" | "register" | "refresh" | "logout" | "unlock" | "cancel",
  ) =>
    action === "cancel"
      ? command({ action: "cancel" })
      : command({ action: `launcher.${action}` });
  const syncing = busy || loading;
  const status = syncing ? "syncing" : authenticated ? "synced" : "unsynced";
  return (
    <Card className="p-0 gap-0">
      <CardHeader className="flex flex-row items-start justify-between p-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Gorth account</CardTitle>
          <CardDescription>
            Manage your Gorth account and encrypted session.
          </CardDescription>
        </div>
        <Badge
          variant={
            syncing ? "secondary" : authenticated ? "default" : "outline"
          }
        >
          {status}
        </Badge>
      </CardHeader>
      <Separator />
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex flex-row gap-2">
          <NavIdentity
            user={{
              name: state?.user?.name ?? profileName,
              email: state?.user ? state.user.email : "local",
              avatar: state?.user?.image,
            }}
            icon={state?.user ? undefined : User}
          />
          {state?.locked && (
            <Button disabled={busy} onClick={() => void run("unlock")}>
              <Unlock /> Unlock
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !state?.configured}
              onClick={() => void run("login")}
            >
              <LogIn />
              {state?.user ? "Switch" : "Sign in"}
            </Button>
            {!state?.user && (
              <Button
                className="h-9"
                variant="outline"
                disabled={busy || !state?.configured}
                onClick={() => void run("register")}
              >
                <UserPlus /> Sign up
              </Button>
            )}
            {state?.user && (
              <>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run("refresh")}
                >
                  <RefreshCw /> Refresh
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run("logout")}
                >
                  <LogOut /> Sign out
                </Button>
              </>
            )}
            {busy && (
              <Button variant="outline" onClick={() => void run("cancel")}>
                <X /> Cancel
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="">
          Saved sessions stay encrypted. Unlocking may require your system
          keychain password. Signing out here does not sign out of Gorth in
          other apps.
        </CardDescription>
      </CardContent>
      {children && (
        <>
          <Separator />
          {children}
        </>
      )}
    </Card>
  );
}
