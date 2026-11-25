import { useEffect, useState } from "react";
import { Camera, FolderOpen, Trash2 } from "@gorth-com/primitive/cores/lucide";
import { Card, CardContent } from "@gorth-com/primitive/default/card";
import { Input } from "@gorth-com/primitive/default/input";
import { Button } from "@gorth-com/primitive/custom/button";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { formatDateTime } from "@/utils/formatter";
import type { InstanceFileEntry } from "@/lib/instance/interface";

interface ScreenshotActions {
  onOpen: (name: string) => void;
  onReveal: (name: string) => void;
  onDelete: (name: string) => void;
  disabled: boolean;
}

function ScreenshotCard({
  shot,
  instanceId,
  onOpen,
  onReveal,
  onDelete,
  disabled,
}: ScreenshotActions & { shot: InstanceFileEntry; instanceId: string }) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useFeedbackToast(error);
  useEffect(() => {
    let active = true;
    setPreview("");
    setError("");
    void window.electronAPI.instanceData
      .command({ action: "screenshot.preview", instanceId, name: shot.name })
      .then((result) => {
        if (!active) return;
        if (result.ok && result.data?.content) setPreview(result.data.content);
        else setError(result.error ?? "Không đọc được ảnh.");
      })
      .catch(() => {
        if (active) setError("Không tải được ảnh.");
      });
    return () => {
      active = false;
    };
  }, [instanceId, shot.name, shot.modifiedAt]);
  return (
    <Card className="overflow-hidden gap-0 py-0">
      {preview ? (
        <img
          src={preview}
          alt={shot.name}
          loading="lazy"
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-muted">
          <Camera className="size-6 text-muted-foreground" />
        </div>
      )}
      <CardContent className="flex flex-col gap-4 p-4">
        <p className="truncate text-sm font-medium">{shot.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(shot.modifiedAt)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpen(shot.name)}>
            Open
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Hiện trong thư mục"
            onClick={() => onReveal(shot.name)}
          >
            <FolderOpen />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            aria-label="Xóa screenshot"
            disabled={disabled}
            onClick={() => onDelete(shot.name)}
          >
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function InstanceScreenshots({
  instanceId,
  shots,
  ...actions
}: ScreenshotActions & { instanceId: string; shots: InstanceFileEntry[] }) {
  const [query, setQuery] = useState("");
  const visible = shots.filter((shot) =>
    shot.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="flex flex-col gap-4">
      <Input
        aria-label="Tìm screenshot"
        placeholder="Tìm screenshot…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.slice(0, 60).map((shot) => (
          <ScreenshotCard
            key={instanceId + shot.name}
            shot={shot}
            instanceId={instanceId}
            {...actions}
          />
        ))}
      </div>
      {!visible.length && (
        <p className="text-sm text-muted-foreground">
          Chưa có screenshot phù hợp. Nhấn F2 khi chơi để chụp ảnh.
        </p>
      )}
      {visible.length > 60 && (
        <p className="text-sm text-muted-foreground">
          Hiển thị 60 ảnh đầu tiên; tìm theo tên để xem ảnh khác.
        </p>
      )}
    </div>
  );
}
