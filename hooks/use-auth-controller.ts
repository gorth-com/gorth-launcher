import { useCallback, useEffect, useRef, useState } from "react";
import {
  useQuery,
  useQueryClient,
} from "@gorth-com/primitive/cores/tanstack/query";
import { resetCallerAuthentication } from "@/lib/auth/client";
import type { AuthCommand, AuthSnapshot, AuthResult } from "@/utils/interface";
import { waitForApplicationReady } from "@/utils/application-ready";

const snapshotKey = ["desktop", "auth", "snapshot"] as const;

export function useAuthController() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const operation = useRef(false);
  const restored = useRef(false);
  const snapshot = useQuery({
    queryKey: snapshotKey,
    queryFn: () => window.electronAPI.auth.snapshot(),
    retry: false,
    gcTime: 0,
    networkMode: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: true,
    // Polling reads local state only; it never unlocks or refreshes credentials.
    refetchInterval: () => (operation.current ? false : 30_000),
  });
  const auth = snapshot.data?.snapshot ?? null;
  const ready = snapshot.isFetched;
  const accept = useCallback(
    (result: AuthResult) => {
      // A command/event is newer than any snapshot already in flight.
      void queryClient.cancelQueries({ queryKey: snapshotKey });
      queryClient.setQueryData(snapshotKey, result);
    },
    [queryClient],
  );
  useEffect(() => {
    const unsubscribe = window.electronAPI.auth.onChanged(
      (value: AuthSnapshot) => accept({ ok: true, snapshot: value }),
    );
    return () => {
      unsubscribe();
    };
  }, [accept]);
  useEffect(() => {
    if (!snapshot.isFetched || restored.current) return;
    restored.current = true;
    const initial = snapshot.data;
    if (
      !initial ||
      !initial.ok ||
      !initial.snapshot.locked ||
      initial.snapshot.pending
    )
      return;
    operation.current = true;
    setRunning(true);
    void (async () => {
      try {
        await waitForApplicationReady();
        const result = await window.electronAPI.auth.command({
          action: "launcher.unlock",
        });
        accept(result);
        if (!result.ok) setError(result.error ?? "");
      } catch {
        setError("Không kết nối được dịch vụ tài khoản.");
      } finally {
        operation.current = false;
        setRunning(false);
      }
    })();
  }, [snapshot.isFetched, accept]);
  const run = useCallback(
    async (command: AuthCommand) => {
      const cancelling = command.action === "cancel";
      if (!cancelling) {
        if (operation.current) return false;
        operation.current = true;
        setRunning(true);
      }
      setError("");
      if (command.action !== "launcher.refresh" && command.action !== "cancel")
        resetCallerAuthentication();
      try {
        const result = await window.electronAPI.auth.command(command);
        accept(result);
        if (!result.ok)
          setError(result.error ?? "Không thể cập nhật tài khoản.");
        return result.ok;
      } catch {
        setError("Không kết nối được dịch vụ tài khoản.");
        return false;
      } finally {
        if (!cancelling) {
          operation.current = false;
          setRunning(false);
        }
      }
    },
    [accept],
  );
  const current = useRef(auth);
  useEffect(() => {
    current.current = auth;
  }, [auth]);
  useEffect(() => {
    const refreshIfNeeded = () => {
      const value = current.current;
      const user = value?.launcher;
      if (
        !user?.canRefresh ||
        value?.locked ||
        value?.pending ||
        operation.current
      )
        return;
      if (
        Date.now() - (user.verifiedAt ?? 0) >= 90_000 ||
        user.expiresAt - Date.now() <= 30_000
      )
        void run({ action: "launcher.refresh" });
    };
    // Credential freshness remains an explicit native-auth policy.
    const timer = setInterval(refreshIfNeeded, 30_000);
    window.addEventListener("focus", refreshIfNeeded);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshIfNeeded);
    };
  }, [run]);
  const account = auth?.launcher ?? null;
  const refresh = useCallback(async () => {
    if (!(await run({ action: "launcher.refresh" }))) return null;
    return (
      queryClient.getQueryData<AuthResult>(snapshotKey)?.snapshot.launcher ??
      null
    );
  }, [run, queryClient]);
  return {
    auth,
    error:
      error ||
      snapshot.data?.error ||
      (snapshot.error ? "Không kết nối được dịch vụ tài khoản." : ""),
    busy: running,
    run,
    ready,
    account,
    username: account?.username ?? null,
    authenticated: !!account && !account.needsLogin,
    loading: !ready,
    locked: !!auth?.locked,
    login: () => run({ action: "launcher.login" }),
    register: () => run({ action: "launcher.register" }),
    logout: () => run({ action: "launcher.logout" }),
    unlock: () => run({ action: "launcher.unlock" }),
    cancel: () => run({ action: "cancel" }),
    refresh,
  };
}
