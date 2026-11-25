import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@gorth-com/primitive/default/card";
import { FieldGroup } from "@gorth-com/primitive/default/field";
import { Separator } from "@gorth-com/primitive/default/separator";
import {
  ScrollArea,
  ScrollBar,
} from "@gorth-com/primitive/default/scroll-area";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  ContentInstallDialog,
  ContentVersionPicker,
} from "./content-install-dialog";
import { toast } from "@/providers/toaster";
import type { ContentStatus, ModpackOverview } from "@/lib/content/interface";

export function ModpackOverviewCard({
  instanceId,
  instanceName,
  unavailable,
}: {
  instanceId: string;
  instanceName: string;
  unavailable: boolean;
}) {
  const [overview, setOverview] = useState<ModpackOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionId, setVersionId] = useState("");
  const [changelog, setChangelog] = useState<{
    text: string;
    format: "html" | "text";
  } | null>(null);
  const [loadingChangelog, setLoadingChangelog] = useState(false);
  const [dialog, setDialog] = useState<"online" | "file" | null>(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<ContentStatus>({
    busy: false,
    message: "",
    completed: 0,
    total: 0,
  });
  const fail = useCallback((error: unknown) => {
    toast.add({
      title:
        error instanceof Error
          ? error.message
          : "Không đọc được thông tin modpack.",
      type: "error",
    });
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    window.electronAPI.content
      .packOverview(instanceId)
      .then((result) => {
        if (!active) return;
        if (!result.ok) throw new Error(result.error);
        setOverview(result.data ?? null);
        setVersionId(
          result.data?.versions[0]?.id ?? result.data?.source?.versionId ?? "",
        );
        if (result.data?.onlineError) fail(new Error(result.data.onlineError));
      })
      .catch((error) => {
        if (active) fail(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [instanceId, revision, fail]);
  useEffect(() => {
    let active = true;
    const cleanup = window.electronAPI.content.onChanged(setStatus);
    window.electronAPI.content
      .status()
      .then((result) => {
        if (active) setStatus(result.status);
      })
      .catch(fail);
    return () => {
      active = false;
      cleanup();
    };
  }, [fail]);
  useEffect(() => {
    let active = true;
    setChangelog(null);
    if (!overview?.source || !versionId) return;
    setLoadingChangelog(true);
    window.electronAPI.content
      .packChangelog(instanceId, versionId)
      .then((result) => {
        if (!active) return;
        if (!result.ok || !result.data) throw new Error(result.error);
        setChangelog(result.data);
      })
      .catch((error) => {
        if (active) fail(error);
      })
      .finally(() => {
        if (active) setLoadingChangelog(false);
      });
    return () => {
      active = false;
    };
  }, [instanceId, overview?.source, versionId, fail]);
  const changelogText = useMemo(() => {
    if (!changelog) return "";
    if (changelog.format === "text") return changelog.text;
    // Parse an inert document; only text reaches React, never provider HTML.
    const document = new DOMParser().parseFromString(
      changelog.text,
      "text/html",
    );
    document
      .querySelectorAll("script,style,iframe,object,embed,template")
      .forEach((node) => node.remove());
    document
      .querySelectorAll("p,div,h1,h2,h3,h4,li,br")
      .forEach((node) => node.append("\n"));
    return document.body.textContent?.trim() ?? "";
  }, [changelog]);
  if (loading && !overview) return null;
  if (!overview) return null;
  const provider =
    overview.source?.provider === "curseforge"
      ? "CurseForge"
      : overview.source?.provider === "modrinth"
        ? "Modrinth"
        : "Local modpack";
  const busy = unavailable || status.busy || loading;
  const canUpdate =
    !!overview.source &&
    !!versionId &&
    versionId !== overview.source.versionId &&
    overview.versions.some((item) => item.id === versionId);
  return (
    <>
      <Card data-modpack-overview className="gap-4 p-4">
        <CardHeader className="p-0">
          <CardTitle>{provider}</CardTitle>
          <CardDescription>Pack Information</CardDescription>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-4 p-0">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-sm">
            <dt>Pack Name</dt>
            <dd className="min-w-0 break-words">{overview.name}</dd>
            <dt>Current version</dt>
            <dd>{overview.currentVersion}</dd>
            <dt>Provider information</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-2">
              {overview.website ? (
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0"
                  onClick={async () => {
                    try {
                      const result =
                        await window.electronAPI.content.packWebsite(
                          instanceId,
                        );
                      if (!result.ok) throw new Error(result.error);
                    } catch (error) {
                      fail(error);
                    }
                  }}
                >
                  {provider}
                </Button>
              ) : (
                <span>{provider}</span>
              )}
              {overview.source && (
                <>
                  <span>Pack ID: {overview.source.projectId}</span>
                  <span>Version ID: {overview.source.versionId}</span>
                </>
              )}
            </dd>
          </dl>
          <Separator />
          <div className="flex flex-wrap items-end gap-4">
            <FieldGroup className="min-w-45 flex-1">
              <ContentVersionPicker
                versions={overview.versions}
                versionId={versionId}
                setVersionId={setVersionId}
                busy={busy}
                pending={loading}
              />
            </FieldGroup>
            <Button
              disabled={busy || !canUpdate}
              onClick={() => setDialog("online")}
            >
              Update Pack
            </Button>
            <Button
              variant="outline"
              disabled={busy || !canUpdate}
              onClick={() => setDialog("file")}
            >
              Update From File
            </Button>
          </div>
          <CardTitle>Changelog</CardTitle>
          <ScrollArea className="h-72 min-w-0" aria-label="Modpack changelog">
            <p className="whitespace-pre-wrap break-words text-sm">
              {loadingChangelog
                ? "Đang tải changelog…"
                : changelogText || "Không có changelog."}
            </p>
            <ScrollBar />
          </ScrollArea>
        </CardContent>
      </Card>
      {dialog && (
        <ContentInstallDialog
          key={dialog}
          open
          onClose={() => setDialog(null)}
          project={{
            id: overview.source?.projectId ?? "",
            name: overview.name,
            description: "",
            downloads: 0,
            url: overview.website ?? "",
          }}
          pack={false}
          targetName={instanceName}
          versions={overview.versions}
          versionId={versionId}
          setVersionId={setVersionId}
          busy={busy}
          pending={loading}
          status={status}
          onCancel={() => {
            void window.electronAPI.content.cancel().catch(fail);
          }}
          onDone={() => setDialog(null)}
          onInstalled={() => setRevision((value) => value + 1)}
          onInstall={async () => {
            try {
              const result = await window.electronAPI.content.updatePack(
                instanceId,
                versionId,
                dialog === "file",
              );
              if (!result.ok) throw new Error(result.error);
              if (result.data?.cancelled) setDialog(null);
              return !result.data?.cancelled;
            } catch (error) {
              fail(error);
              return false;
            }
          }}
        />
      )}
    </>
  );
}
