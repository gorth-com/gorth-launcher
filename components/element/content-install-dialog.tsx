import { useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@gorth-com/primitive/default/dialog";
import { Field, FieldLabel } from "@gorth-com/primitive/default/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@gorth-com/primitive/custom/select";
import { Progress } from "@gorth-com/primitive/default/progress";
import { Separator } from "@gorth-com/primitive/default/separator";
import { Button } from "@gorth-com/primitive/custom/button";
import { cn } from "@gorth-com/primitive/cores/cn";
import { LogViewer } from "./log-viewer";
import { OptionalModsTable } from "./optional-mods-table";
import type {
  ContentProject,
  ContentVersion,
  ContentStatus,
} from "@/lib/content/interface";

interface VersionPickerProps {
  versions: ContentVersion[];
  versionId: string;
  setVersionId: (id: string) => void;
  busy: boolean;
  pending: boolean;
}

export function ContentVersionPicker({
  versions,
  versionId,
  setVersionId,
  busy,
  pending,
}: VersionPickerProps) {
  const id = useId();
  return (
    <Field className="min-w-0 gap-1">
      <FieldLabel htmlFor={id}>Phiên bản release</FieldLabel>
      <Select
        items={
          versions.length
            ? versions.map((version) => ({
                value: version.id,
                label: version.name,
              }))
            : [
                {
                  value: "",
                  label: pending
                    ? "Đang lấy phiên bản…"
                    : "Không có bản phù hợp",
                },
              ]
        }
        value={versionId}
        disabled={busy || !versions.length}
        onValueChange={(value) => {
          if (value !== null) setVersionId(String(value));
        }}
      >
        <SelectTrigger
          id={id}
          aria-label="Phiên bản release"
          className="w-full min-w-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {!versions.length && (
              <SelectItem value="">
                {pending ? "Đang lấy phiên bản…" : "Không có bản phù hợp"}
              </SelectItem>
            )}
            {versions.map((version) => (
              <SelectItem key={version.id} value={version.id}>
                {version.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

export function ContentInstallDialog({
  open,
  onClose,
  project,
  pack,
  targetName,
  status,
  onInstall,
  onCancel,
  onDone,
  onInstalled,
  ...picker
}: VersionPickerProps & {
  open: boolean;
  onClose: () => void;
  project: ContentProject;
  pack: boolean;
  targetName?: string;
  status: ContentStatus;
  onInstall: () => Promise<boolean>;
  onCancel: () => void;
  onDone: () => void;
  onInstalled?: () => void;
}) {
  const [stage, setStage] = useState<"choose" | "running" | "done" | "failed">(
    "choose",
  );
  const [cancelling, setCancelling] = useState(false);
  const running = stage === "running";
  const progressView = stage !== "choose";
  const optional = running ? status.optionalMods : undefined;
  async function install() {
    setStage("running");
    setCancelling(false);
    try {
      if (await onInstall()) {
        setStage("done");
        onInstalled?.();
      } else setStage("failed");
    } catch {
      setStage("failed");
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !running) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!running}
        className={cn(
          progressView &&
            "flex h-[min(590px,90dvh)] max-h-[90dvh] flex-col overflow-hidden sm:max-w-4xl",
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {optional
              ? "Chọn mod tùy chọn —"
              : progressView
                ? "Cài đặt"
                : "Chọn phiên bản"}{" "}
            {project.name}
          </DialogTitle>
          <DialogDescription>
            {optional
              ? "Mod được chọn sẽ được bật. Các mod còn lại giữ trạng thái tắt."
              : progressView
                ? stage === "done"
                  ? "Cài đặt hoàn tất."
                  : "Tiến độ tải và cài đặt nội dung."
                : pack
                  ? "Chọn phiên bản để tạo một instance mới trong thư viện. Minecraft và loader được lấy từ modpack."
                  : `Cài vào ${targetName ?? "instance đã chọn"}.`}
          </DialogDescription>
        </DialogHeader>
        {optional ? (
          <OptionalModsTable
            key={optional.requestId}
            {...optional}
            onCancel={onCancel}
          />
        ) : progressView ? (
          <>
            <Separator />
            <div
              className="flex min-h-0 flex-1 overflow-hidden"
              aria-label="Download log"
            >
              <LogViewer
                content={(status.logs ?? []).join("\n") || "Đang chuẩn bị…"}
                className="max-h-none"
                fill
              />
            </div>
            <div role="status" className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <p>{status.message || "Đang chuẩn bị…"}</p>
                {status.total > 0 && (
                  <span className="shrink-0 text-muted-foreground">
                    {status.completed}/{status.total}
                  </span>
                )}
              </div>
              <Progress
                aria-label="Tiến độ cài đặt nội dung"
                value={
                  stage === "done"
                    ? 100
                    : status.total > 0
                      ? Math.min(100, (status.completed / status.total) * 100)
                      : null
                }
              />
            </div>
            <Separator />
          </>
        ) : (
          <ContentVersionPicker {...picker} />
        )}
        {!optional && (
          <DialogFooter>
            {running ? (
              <Button
                variant="outline"
                disabled={cancelling}
                onClick={() => {
                  setCancelling(true);
                  onCancel();
                }}
              >
                {cancelling ? "Đang hủy…" : "Cancel"}
              </Button>
            ) : stage === "done" ? (
              <Button onClick={onDone}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>
                  Đóng
                </Button>
                <Button
                  disabled={
                    picker.busy || !picker.versionId || (!pack && !targetName)
                  }
                  onClick={() => void install()}
                >
                  {stage === "failed" ? "Thử lại" : "Cài đặt"}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
