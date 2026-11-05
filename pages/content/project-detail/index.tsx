import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@gorth-io/primitive/default/select";
import { contentLabels } from "@/utils/constant";
import { useState } from "react";
import { Download, Layers } from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@gorth-io/primitive/default/dialog";
import type {
  ContentProject,
  ContentQuery,
  ContentStatus,
  ContentVersion,
} from "@/lib/content/interface";

import { formatNumber } from "@/utils/formatter";
import { ProjectWebview } from "../project-webview";

export function ProjectDetail({
  project,
  query,
  versions,
  versionId,
  setVersionId,
  busy,
  pending,
  status,
  targetName,
  onBack,
  onInstall,
  onLibrary,
  onCancel,
  hideWebview,
  initialInstallOpen = false,
}: {
  project: ContentProject;
  query: ContentQuery;
  versions: ContentVersion[];
  versionId: string;
  setVersionId: (id: string) => void;
  busy: boolean;
  pending: boolean;
  status: ContentStatus;
  targetName?: string;
  onBack: () => void;
  onInstall: () => Promise<boolean>;
  onLibrary: () => void;
  onCancel: () => void;
  hideWebview: boolean;
  initialInstallOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialInstallOpen);
  const [installed, setInstalled] = useState(false);
  const pack = query.kind === "modpack";
  const canInstall = !!versionId && (pack || !!targetName) && !busy;
  const picker = (
    <label className="grid min-w-0 gap-2 text-sm">
      Phiên bản release
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
        onValueChange={(selectedValue) => {
          if (selectedValue === null) return;
          setVersionId(String(selectedValue));
        }}
      >
        <SelectTrigger
          aria-label="Phiên bản release"
          className="w-full min-w-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
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
        </SelectContent>
      </Select>
    </label>
  );
  const feedback = (
    <>
      {!status.error && status.message && (
        <div role="status" className="space-y-2 text-sm">
          <p>{status.message}</p>
          {status.total > 0 && (
            <progress
              className="w-full"
              max={status.total}
              value={status.completed}
            />
          )}
          {status.busy && (
            <Button className="h-9" variant="outline" onClick={onCancel}>
              Hủy tải
            </Button>
          )}
        </div>
      )}
    </>
  );
  return (
    <section className="flex h-full min-h-0 min-w-0">
      <ProjectWebview
        url={project.url}
        hidden={open || hideWebview}
        onBack={onBack}
        backDisabled={pending}
      />
      <aside
        aria-label="Chi tiết dự án"
        className="w-80 shrink-0 space-y-5 overflow-y-auto border-l bg-card p-5"
      >
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {query.provider === "modrinth" ? "Modrinth" : "CurseForge"} ·{" "}
            {contentLabels[query.kind]}
          </p>
          <h3 className="font-semibold">{project.name}</h3>
          <p className="break-words text-sm text-muted-foreground">
            {project.description}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatNumber(project.downloads)} lượt tải
          </p>
        </div>
        <div className="space-y-1 text-sm">
          <p>Minecraft {query.version}</p>
          {(query.kind === "mod" || pack) && <p>{query.loader}</p>}
          {!pack && <p>Instance: {targetName ?? "Chưa chọn"}</p>}
        </div>
        {picker}
        <Button
          className="h-9 w-full"
          disabled={!canInstall}
          onClick={() => setOpen(true)}
        >
          <Download size={16} /> Cài đặt{pack ? " modpack" : ""}
        </Button>
        {!pack && !targetName && (
          <p className="text-xs text-muted-foreground">
            Quay lại kết quả và chọn instance để cài nội dung.
          </p>
        )}
        {query.kind === "shader" && (
          <p className="text-xs text-muted-foreground">
            Launcher sẽ tự cài Iris và dependency phù hợp cho instance Fabric
            hoặc NeoForge.
          </p>
        )}
        {!open && feedback}
        {installed && (
          <div className="space-y-2 text-sm">
            <p>
              {pack
                ? "Đã tạo instance. Mở thư viện và chọn Chơi để tải runtime/game và khởi chạy."
                : "Đã cài nội dung vào instance."}
            </p>
            <Button
              className="h-9 w-full"
              variant="outline"
              onClick={onLibrary}
            >
              <Layers size={16} /> Mở thư viện instance
            </Button>
          </div>
        )}
      </aside>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Cài đặt {project.name}</DialogTitle>
            <DialogDescription>
              {pack
                ? "Chọn phiên bản để tạo một instance mới trong thư viện. Minecraft và loader được lấy từ modpack."
                : `Cài vào ${targetName ?? "instance đã chọn"}.`}
            </DialogDescription>
          </DialogHeader>
          {picker}
          <p className="text-xs text-muted-foreground">
            {pack
              ? "Chỉ chấp nhận loader nằm trong danh sách ổn định của launcher."
              : "Mod sẽ kèm dependency bắt buộc; shader tự cài Iris; texture/data pack được lưu đúng thư mục."}
          </p>
          {feedback}
          <DialogFooter>
            <Button
              className="h-9"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Đóng
            </Button>
            <Button
              className="h-9"
              disabled={!canInstall}
              onClick={async () => {
                const ok = await onInstall();
                if (ok) {
                  setInstalled(true);
                  setOpen(false);
                }
              }}
            >
              <Download size={16} />
              {busy ? "Đang cài đặt…" : "Cài đặt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
