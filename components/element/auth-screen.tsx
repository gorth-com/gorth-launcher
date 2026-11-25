import { useEffect, useRef, useState } from "react";
import { Button } from "@gorth-com/primitive/custom/button";
import { useAuth } from "@/hooks/use-auth";
import type { AuthViewState } from "@/lib/auth/view-types";
import { cn } from "@gorth-com/primitive/cores/cn";

export function AuthScreen({
  onReturn,
  compact = false,
}: {
  onReturn: () => void;
  compact?: boolean;
  showLogo?: boolean;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}) {
  const auth = useAuth();
  const [view, setView] = useState<AuthViewState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const returnToProfile = useRef(onReturn);
  useEffect(() => {
    returnToProfile.current = onReturn;
  }, [onReturn]);
  useEffect(() => {
    let active = true;
    let notified = false;
    const unsubscribe = window.electronAPI.auth.onViewChanged((state) => {
      notified = true;
      if (active) {
        setView(state);
        if (state.visible) setDismissed(false);
      }
    });
    async function readState() {
      try {
        const state = await window.electronAPI.auth.viewState();
        if (active && !notified) setView(state);
      } catch {
        /* The account command exposes any main-process error. */
      }
    }
    void readState();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const completed = !!view?.completed && auth.authenticated && !auth.error;
  useEffect(() => {
    if (!completed || dismissed) return;
    const timer = window.setTimeout(() => {
      setDismissed(true);
      returnToProfile.current();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [completed, dismissed]);
  if (dismissed || (!view?.visible && !view?.completed)) return null;
  return (
    <section
      aria-label="Xác thực Gorth"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background p-8",
        compact ? "top-14" : "top-28",
      )}
    >
      <h1 className="text-xl font-semibold">
        {completed ? "Đăng nhập thành công" : "Đăng nhập Gorth"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {view?.visible
          ? "Chọn tài khoản trong trình duyệt vừa mở. Phiên SSO của bạn được giữ nguyên."
          : "Đăng nhập bằng tài khoản Gorth SSO."}
      </p>

      {view?.visible ? (
        <Button
          className="h-9"
          onClick={async () => {
            await auth.cancel();
            setDismissed(true);
            onReturn();
          }}
        >
          Hủy đăng nhập
        </Button>
      ) : (
        <Button
          className="h-9"
          onClick={() => {
            setDismissed(true);
            onReturn();
          }}
        >
          Quay lại hồ sơ
        </Button>
      )}
    </section>
  );
}
