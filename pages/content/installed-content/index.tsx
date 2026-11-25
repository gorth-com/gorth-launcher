import { confirmAction } from "@/lib/confirmation";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { contentLabels } from "@/utils/constant";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Switch } from "@gorth-com/primitive/default/switch";
import { Input } from "@gorth-com/primitive/default/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@gorth-com/primitive/default/card";
import {
  Grid2X2,
  List,
  RefreshCw,
  Trash2,
  Search,
} from "@gorth-com/primitive/cores/lucide";
import { Badge } from "@gorth-com/primitive/custom/badge";
import { Button } from "@gorth-com/primitive/custom/button";
import { ContentProjectCard } from "@/components/element/content-project-card";
import type { Instance } from "@/utils/interface";
import type {
  ContentInventory,
  ContentManageAction,
} from "@/lib/content/interface";

export function InstalledContentManager({
  instance,
  unavailable,
  kind,
  toolbarActions,
}: {
  instance: Instance;
  unavailable: boolean;
  kind?: import("@/lib/content/interface").ContentKind;
  toolbarActions?: ReactNode;
}) {
  const instanceId = instance.id;
  const [inventory, setInventory] = useState<ContentInventory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [metadata, setMetadata] = useState<ContentInventory["items"]>([]);
  const [identifying, setIdentifying] = useState(false);
  const epoch = useRef(0);
  useFeedbackToast(error);
  const load = async (updates = false) => {
    if (!instanceId) return;
    const revision = ++epoch.current;
    setBusy(true);
    setError("");
    try {
      const result = updates
        ? await window.electronAPI.content.updates(instanceId)
        : await window.electronAPI.content.inventory(instanceId);
      if (!result.ok || !result.data)
        throw new Error(result.error ?? "Không đọc được nội dung đã cài.");
      if (revision !== epoch.current) return;
      setInventory(result.data);
      if (
        (!kind || kind === "mod") &&
        result.data.items.some((item) => item.kind === "mod")
      ) {
        setIdentifying(true);
        void window.electronAPI.content
          .metadata(instanceId)
          .then((online) => {
            if (revision !== epoch.current) return;
            if (!online.ok || !online.data)
              throw new Error(
                online.error ?? "Không nhận diện được metadata mod.",
              );
            setMetadata(online.data.items);
            if (online.data.metadataError) setError(online.data.metadataError);
          })
          .catch(() => {
            if (revision === epoch.current)
              setError(
                "Không tải được metadata online; danh sách file local vẫn được giữ.",
              );
          })
          .finally(() => {
            if (revision === epoch.current) setIdentifying(false);
          });
      } else setIdentifying(false);
    } catch (reason) {
      if (revision === epoch.current)
        setError(
          reason instanceof Error ? reason.message : "Không đọc được nội dung.",
        );
    } finally {
      if (revision === epoch.current) setBusy(false);
    }
  };
  useEffect(() => {
    setMetadata([]);
    void load(false);
    return () => {
      epoch.current++;
    };
  }, [instanceId]);
  const manage = async (id: string, action: ContentManageAction) => {
    if (!instanceId) return;
    setBusy(true);
    setError("");
    try {
      const result = await window.electronAPI.content.manage({
        action,
        instanceId,
        id,
      });
      if (!result.ok || !result.data)
        throw new Error(result.error ?? "Không thay đổi được nội dung.");
      setInventory(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      data-installed-content
      className={
        kind === "mod"
          ? "grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3"
          : "flex min-w-0 flex-col"
      }
    >
      <div
        className={
          kind === "mod"
            ? "flex min-w-0 flex-col gap-6 lg:col-span-2"
            : "flex min-w-0 flex-col gap-6"
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-9"
            variant="outline"
            disabled={!instanceId || busy || unavailable}
            onClick={() => void load(false)}
          >
            Tải danh sách
          </Button>
          <Button
            className="h-9"
            variant="outline"
            disabled={!instanceId || busy || unavailable}
            onClick={() => void load(true)}
          >
            <RefreshCw size={16} /> Kiểm tra cập nhật
          </Button>
          {toolbarActions}
          <div
            className="ml-auto flex gap-2"
            role="group"
            aria-label="Installed content layout"
          >
            <Button
              size="icon"
              variant={layout === "grid" ? "default" : "outline"}
              aria-label="Grid layout"
              aria-pressed={layout === "grid"}
              onClick={() => setLayout("grid")}
            >
              <Grid2X2 />
            </Button>
            <Button
              size="icon"
              variant={layout === "list" ? "default" : "outline"}
              aria-label="List layout"
              aria-pressed={layout === "list"}
              onClick={() => setLayout("list")}
            >
              <List />
            </Button>
          </div>
        </div>

        {inventory &&
          !inventory.items.some((item) => !kind || item.kind === kind) && (
            <p className="text-sm text-muted-foreground">
              Chưa tìm thấy mod, resource pack, shader hoặc data pack.
            </p>
          )}
        <div
          className={
            layout === "grid"
              ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-4"
          }
        >
          {inventory?.items
            .filter((item) => !kind || item.kind === kind)
            .map((item) => ({
              ...item,
              metadata:
                metadata.find(
                  (value) =>
                    value.id === item.id && value.checksum === item.checksum,
                )?.metadata ?? item.metadata,
            }))
            .filter((item) =>
              [
                item.filename,
                item.metadata?.project.name,
                item.metadata?.project.author,
              ].some((value) =>
                value?.toLowerCase().includes(query.toLowerCase()),
              ),
            )
            .map((item) => (
              <ContentProjectCard
                key={item.id}
                layout={layout}
                busy={busy || unavailable}
                project={
                  item.metadata?.project ?? {
                    id: item.id,
                    name: item.filename,
                    url: "",
                    downloads: 0,
                    description: item.managed
                      ? `${item.provider} · ${item.versionId}${item.worldName ? ` · ${item.worldName}` : ""}`
                      : "File local · chưa có metadata online",
                  }
                }
                metadata={
                  <>
                    <Badge variant="outline">{contentLabels[item.kind]}</Badge>
                    {(item.metadata?.provider ??
                      item.provider ??
                      item.origin?.provider) && (
                      <Badge variant="outline">
                        {(item.metadata?.provider ??
                          item.provider ??
                          item.origin?.provider) === "curseforge"
                          ? "CurseForge"
                          : "Modrinth"}
                      </Badge>
                    )}
                    {item.metadata?.versionName && (
                      <Badge variant="secondary">
                        {item.metadata.versionName}
                      </Badge>
                    )}
                    <Badge variant="secondary">{instance.loader}</Badge>
                    <Badge variant="secondary">{instance.version}</Badge>
                    {!item.enabled && <Badge variant="secondary">Đã tắt</Badge>}
                    {item.modified && (
                      <Badge variant="destructive">Đã sửa file</Badge>
                    )}
                    {item.update && <Badge>Có bản mới</Badge>}
                  </>
                }
                footerActions={
                  item.kind !== "modpack" ? (
                    <Switch
                      checked={item.enabled}
                      disabled={busy || unavailable}
                      aria-label={`Bật ${item.metadata?.project.name ?? item.filename}`}
                      onCheckedChange={(checked) =>
                        void manage(item.id, checked ? "enable" : "disable")
                      }
                    />
                  ) : undefined
                }
                actions={
                  <>
                    {item.kind !== "modpack" && (
                      <div className="flex shrink-0 gap-2">
                        {item.managed && item.update && (
                          <Button
                            className="h-9"
                            size="sm"
                            disabled={busy || unavailable || item.modified}
                            onClick={() => void manage(item.id, "update")}
                          >
                            Cập nhật
                          </Button>
                        )}
                        <Button
                          className="h-9"
                          size="icon-sm"
                          variant="destructive"
                          disabled={busy || unavailable}
                          aria-label={`Xóa ${item.filename}`}
                          onClick={async () => {
                            if (await confirmAction(`Xóa ${item.filename}?`))
                              void manage(item.id, "remove");
                          }}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    )}
                    {item.managed && item.kind === "modpack" && item.update && (
                      <Button
                        className="h-9 shrink-0"
                        disabled={busy || unavailable}
                        onClick={() => void manage(item.id, "update")}
                      >
                        Cập nhật pack
                      </Button>
                    )}
                  </>
                }
              />
            ))}
        </div>
      </div>
      {kind === "mod" && (
        <aside className="flex min-w-0 flex-col gap-6">
          <form
            role="search"
            className="flex min-w-0 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(searchInput);
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`mod-search-${instanceId}`}
                aria-label="Tìm mod đã cài"
                className="pl-9"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tên mod, tác giả hoặc file JAR…"
              />
            </div>
            <Button type="submit" size="icon" aria-label="Search">
              <Search />
            </Button>
          </form>
          <Card className="gap-4 p-4">
            <CardHeader className="p-0">
              <CardTitle>Mods</CardTitle>
              <CardDescription>
                {instance.name} · {instance.loader} {instance.version}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-0">
              <CardDescription>
                {inventory?.items.filter((item) => item.kind === "mod")
                  .length ?? 0}{" "}
                mod ·{" "}
                {identifying
                  ? "Đang nhận diện metadata…"
                  : "Thông tin theo nguồn tải hoặc hash JAR"}
              </CardDescription>
            </CardContent>
          </Card>
        </aside>
      )}
    </div>
  );
}
