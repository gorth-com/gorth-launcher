import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { useEffect, useRef, useState } from "react";
import { Button } from "@gorth-io/primitive/custom/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@gorth-io/primitive/default/card";
import type { UpdateState } from "@/lib/update/interface";
export function AppUpdateCard() {
  const [state, setState] = useState<UpdateState>();
  const [error, setError] = useState("");
  useFeedbackToast(error || (state?.status === "error" ? state.message : ""));
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const revision = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    const unsubscribe = window.electronAPI.updates.onChanged((value) => {
      revision.current++;
      if (active) setState(value);
    });
    async function load() {
      const observed = revision.current;
      try {
        const value = await window.electronAPI.updates.state();
        if (active && revision.current === observed) setState(value);
      } catch {
        if (active) setError("Không đọc được trạng thái cập nhật.");
      }
    }
    void load();
    return () => {
      active = false;
      mounted.current = false;
      unsubscribe();
    };
  }, []);
  async function run(action: "check" | "download" | "install") {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    const observed = revision.current;
    try {
      const value = await window.electronAPI.updates[action]();
      if (mounted.current && revision.current === observed) setState(value);
    } catch {
      if (mounted.current)
        setError("Không thực hiện được yêu cầu cập nhật. Hãy thử lại.");
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  const working =
    pending ||
    state?.status === "checking" ||
    state?.status === "downloading" ||
    state?.status === "installing";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cập nhật ứng dụng</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p>
          Phiên bản hiện tại: <strong>{state?.version ?? "Đang đọc…"}</strong>
        </p>
        {state?.availableVersion && (
          <p>Phiên bản mới: {state.availableVersion}</p>
        )}
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          {state?.status === "error" ? null : state?.message}
        </p>

        <div className="flex flex-wrap gap-2">
          {state?.status === "available" ? (
            <Button disabled={working} onClick={() => void run("download")}>
              Tải bản mới
            </Button>
          ) : state?.status === "downloaded" ? (
            <Button disabled={working} onClick={() => void run("install")}>
              Khởi động lại để cập nhật
            </Button>
          ) : (
            <Button
              disabled={!state || working || state.status === "disabled"}
              onClick={() => void run("check")}
            >
              Kiểm tra cập nhật
            </Button>
          )}
          <Button
            variant="outline"
            disabled={working}
            onClick={async () => {
              try {
                await window.electronAPI.updates.openReleases();
              } catch {
                setError("Không mở được GitHub Releases.");
              }
            }}
          >
            GitHub Releases
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Chỉ tải sau khi bạn xác nhận. Bản đã tải cũng có thể được cài ở lần mở
          ứng dụng tiếp theo.
        </p>
      </CardContent>
    </Card>
  );
}
