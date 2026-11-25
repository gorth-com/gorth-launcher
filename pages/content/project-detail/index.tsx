import {
  ContentInstallDialog,
  ContentVersionPicker,
} from "@/components/element/content-install-dialog";
import { Progress } from "@gorth-com/primitive/default/progress";
import { contentLabels } from "@/utils/constant";
import { useState, type CSSProperties } from "react";
import { Copy, Download, Layers } from "@gorth-com/primitive/cores/lucide";
import { Badge } from "@gorth-com/primitive/custom/badge";
import { Separator } from "@gorth-com/primitive/default/separator";
import { CardTitle } from "@gorth-com/primitive/default/card";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
} from "@gorth-com/primitive/custom/sidebar";
import { toast } from "@/providers/toaster";
import { Button } from "@gorth-com/primitive/custom/button";

import type {
  ContentProject,
  ContentQuery,
  ContentStatus,
  ContentVersion,
} from "@/lib/content/interface";

import { formatDateTime, formatNumber } from "@/utils/formatter";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pack = query.kind === "modpack";
  const selectedVersion = versions.find((version) => version.id === versionId);
  const gameVersions =
    selectedVersion?.gameVersions ?? (query.version ? [query.version] : []);
  const loaders =
    selectedVersion?.loaders ?? (query.loader ? [query.loader] : []);
  const dateLabel = (value?: string) =>
    value && Number.isFinite(Date.parse(value))
      ? formatDateTime(new Date(value))
      : "Không cung cấp";
  const canInstall = !!versionId && (pack || !!targetName) && !busy;
  const picker = () => (
    <ContentVersionPicker
      versions={versions}
      versionId={versionId}
      setVersionId={setVersionId}
      busy={busy}
      pending={pending}
    />
  );
  const feedback = (
    <>
      {!status.error && status.message && (
        <div role="status" className="flex flex-col gap-2 text-sm">
          <p>{status.message}</p>
          {status.total > 0 && (
            <Progress
              aria-label="Tiến độ cài đặt nội dung"
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
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      className="h-full min-h-0 min-w-0"
      style={{ "--sidebar-width": "360px" } as CSSProperties}
    >
      <ProjectWebview
        url={project.url}
        hidden={open || hideWebview}
        onBack={onBack}
        backDisabled={pending}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((value) => !value)}
      />
      {sidebarOpen && (
        <Sidebar
          side="right"
          collapsible="none"
          id="project-detail-sidebar"
          aria-label="Chi tiết dự án"
          className="min-h-0 shrink-0 gap-0 overflow-hidden border-l p-0"
        >
          <SidebarHeader className="gap-4 p-4">
            <Badge variant="secondary" className="self-start">
              {query.provider === "modrinth" ? "Modrinth" : "CurseForge"}
            </Badge>
            <CardTitle>{project.name}</CardTitle>
            <p className="break-words text-sm text-muted-foreground">
              {project.description}
            </p>
          </SidebarHeader>
          <Separator />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <SidebarContent
              className="flex-none gap-4 overflow-visible p-4"
              aria-label="Details"
            >
              <CardTitle>Details</CardTitle>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 text-sm leading-5">
                <dt className="text-muted-foreground">Downloads:</dt>
                <dd>{formatNumber(project.downloads)}</dd>
                <dt className="text-muted-foreground">Created:</dt>
                <dd>{dateLabel(project.publishedAt)}</dd>
                <dt className="text-muted-foreground">Updated:</dt>
                <dd>{dateLabel(project.updatedAt)}</dd>
                <dt className="text-muted-foreground">Project ID:</dt>
                <dd className="flex min-w-0 items-start gap-2 leading-5">
                  <span className="break-all">{project.id}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-5 shrink-0 p-0"
                    aria-label="Copy project ID"
                    onClick={() =>
                      void navigator.clipboard.writeText(project.id).then(
                        () =>
                          toast.add({
                            title: "Đã sao chép Project ID",
                            type: "success",
                          }),
                        () =>
                          toast.add({
                            title: "Không sao chép được Project ID",
                            type: "error",
                          }),
                      )
                    }
                  >
                    <Copy className="size-4" />
                  </Button>
                </dd>
                <dt className="text-muted-foreground">License:</dt>
                <dd className="text-muted-foreground">Không cung cấp</dd>
              </dl>
            </SidebarContent>
            <Separator />
            <SidebarContent
              className="flex-none gap-4 overflow-visible p-4"
              aria-label="Game Versions"
            >
              <CardTitle>Game Versions</CardTitle>
              <div className="flex flex-wrap gap-2">
                {[...new Set(gameVersions)].map((version) => (
                  <Badge key={version} variant="secondary">
                    {version}
                  </Badge>
                ))}
                {!gameVersions.length && (
                  <p className="text-sm text-muted-foreground">
                    Không cung cấp
                  </p>
                )}
              </div>
            </SidebarContent>
            <Separator />
            <SidebarContent
              className="flex-none gap-4 overflow-visible p-4"
              aria-label="Mod Loaders"
            >
              <CardTitle>Mod Loaders</CardTitle>
              <div className="flex flex-wrap gap-2">
                {[...new Set(loaders)].map((loader) => (
                  <Badge key={loader} variant="secondary">
                    {loader}
                  </Badge>
                ))}
                {!loaders.length && (
                  <p className="text-sm text-muted-foreground">
                    Không cung cấp
                  </p>
                )}
              </div>
            </SidebarContent>
            <Separator />
            <SidebarContent
              className="flex-none gap-4 overflow-visible p-4"
              aria-label="Class & Categories"
            >
              <CardTitle>Class &amp; Categories</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{contentLabels[query.kind]}</Badge>
                {[...new Set(project.categories ?? [])].map((category) => (
                  <Badge key={category} variant="secondary">
                    {category}
                  </Badge>
                ))}
              </div>
            </SidebarContent>
            <SidebarContent className="flex-none gap-4 overflow-visible px-4 pb-4">
              {!pack && (
                <p className="text-sm">Instance: {targetName ?? "Chưa chọn"}</p>
              )}
              {!open && feedback}
              {installed && (
                <div className="flex flex-col gap-2 text-sm">
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
            </SidebarContent>
          </div>
          <Separator />
          <SidebarFooter className="gap-4 p-4">
            {picker()}
            <Button
              className="h-9 w-full"
              disabled={!canInstall}
              onClick={() => setOpen(true)}
            >
              <Download size={16} /> Cài đặt{pack ? " modpack" : ""}
            </Button>
          </SidebarFooter>
        </Sidebar>
      )}
      <ContentInstallDialog
        key={open ? "open" : "closed"}
        open={open}
        onClose={() => setOpen(false)}
        project={project}
        pack={pack}
        targetName={targetName}
        versions={versions}
        versionId={versionId}
        setVersionId={setVersionId}
        busy={busy}
        pending={pending}
        status={status}
        onInstall={onInstall}
        onCancel={onCancel}
        onDone={onLibrary}
        onInstalled={() => setInstalled(true)}
      />
    </SidebarProvider>
  );
}
