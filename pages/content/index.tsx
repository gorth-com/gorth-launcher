import { PageHeading } from "@/components/heading";
import { Progress } from "@gorth-io/primitive/default/progress";
import { contentIcons } from "@/utils/constant";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@gorth-io/primitive/default/select";
import { contentLabels, loaderCatalog } from "@/utils/constant";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useForm } from "@gorth-io/primitive/cores/tanstack/form";
import {
  Search,
  Upload,
  LayoutGrid,
  List,
  Package,
  ChevronLeft,
  ChevronRight,
} from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import { Input } from "@gorth-io/primitive/default/input";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
import { Field, FieldLabel } from "@gorth-io/primitive/default/field";
import { PageShell } from "@/layouts/page-shell";
import { PageBanner } from "@/components/element/page-banner";
import modsBackground from "@/public/dawn/mod.png";
import shaderBackground from "@/public/dawn/shader.png";
import resourceBackground from "@/public/dawn/background2.png";
import { ContentInstallDialog } from "@/components/element/content-install-dialog";
import { mergeContentProgress } from "@/utils/content-progress";
import { ProjectDetail } from "./project-detail";

import { ContentProjectCard } from "@/components/element/content-project-card";
import { supportedLoader } from "@/lib/game/catalog";
import type { Instance, InstanceSelectionProps } from "@/utils/interface";
import type {
  ContentProvider,
  ContentKind,
  ContentProject,
  ContentQuery,
  ContentStatus,
  ContentVersion,
  ContentResult,
} from "@/lib/content/interface";

export function ContentPage({
  instances,
  gameBusy,
  onLibrary,
  hideWebview,
  onDetailChange,
  fixedKind,
  catalogMode = false,
  catalogTabs,
  initialProvider = "modrinth",
  selectedInstanceId = "",
  onInstanceChange,
}: Partial<InstanceSelectionProps> & {
  instances: Instance[];
  gameBusy: boolean;
  onLibrary: () => void;
  hideWebview: boolean;
  onDetailChange: (active: boolean) => void;
  fixedKind?: ContentKind;
  catalogMode?: boolean;
  catalogTabs?: ReactNode;
  initialProvider?: ContentProvider;
}) {
  const filterId = useId();
  const [status, setStatus] = useState<ContentStatus>({
    busy: false,
    message: "",
    completed: 0,
    total: 0,
  });
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] =
    useState<NonNullable<ContentQuery["sort"]>>("relevance");
  const [configured, setConfigured] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useFeedbackToast(error || status.error);
  const [results, setResults] = useState<{
    projects: ContentProject[];
    more: boolean;
  } | null>(null);
  const [searched, setSearched] = useState<ContentQuery | null>(null);
  const [target, setTarget] = useState("");
  const [targetWorld, setTargetWorld] = useState("");
  const [worlds, setWorlds] = useState<string[]>([]);
  const [selected, setSelected] = useState<ContentProject | null>(null);
  const [installRequested, setInstallRequested] = useState(false);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [versionId, setVersionId] = useState("");
  useEffect(() => {
    onDetailChange(Boolean(selected) && !installRequested);
    return () => onDetailChange(false);
  }, [selected, installRequested, onDetailChange]);
  useEffect(() => {
    let live = true;
    let observed = false;
    const unsubscribe = window.electronAPI.content.onChanged((next) => {
      observed = true;
      setStatus((previous) => mergeContentProgress(previous, next));
    });
    void window.electronAPI.content
      .status()
      .then((value) => {
        if (live) {
          if (!observed) setStatus(value.status);
          setConfigured(value.curseforgeConfigured);
        }
      })
      .catch(() => {
        if (live) setError("Không kết nối được dịch vụ nội dung.");
      });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  async function execute<T>(
    operation: () => Promise<ContentResult<T>>,
  ): Promise<T | undefined> {
    setPending(true);
    setError("");
    try {
      const result = await operation();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Không xử lý được yêu cầu.",
      );
    } finally {
      setPending(false);
    }
  }
  async function search(
    query: ContentQuery,
    instanceId: string,
    worldName = "",
  ) {
    setSelected(null);
    setVersions([]);
    setResults(null);
    setSearched(query);
    setTarget(instanceId);
    setTargetWorld(worldName);
    const result = await execute(() =>
      window.electronAPI.content.search(query),
    );
    if (result) setResults(result);
  }
  async function openProject(project: ContentProject, install = false) {
    if (!searched) return;
    setSelected(project);
    setInstallRequested(install);
    setVersions([]);
    setVersionId("");
    const items = await execute(() =>
      window.electronAPI.content.versions(searched, project.id),
    );
    if (items) {
      setVersions(items);
      setVersionId(items[0]?.id ?? "");
    }
  }
  const form = useForm({
    defaultValues: {
      provider: initialProvider as ContentProvider,
      kind: fixedKind ?? ("modpack" as ContentKind),
      query: "",
      preset: "0",
      instanceId: selectedInstanceId,
      worldName: "",
    },
    onSubmit: async ({ value }) => {
      const preset = loaderCatalog[Number(value.preset)] ?? loaderCatalog[0];
      const instance = instances.find((item) => item.id === value.instanceId);
      if (
        value.kind === "mod" &&
        instance &&
        (instance.loader === "Vanilla" || !supportedLoader(instance))
      ) {
        setError("Chọn instance có mod loader được hỗ trợ.");
        return;
      }
      if (value.kind === "datapack" && (!instance || !value.worldName)) {
        setError("Chọn instance và world để cài data pack.");
        return;
      }
      await search(
        {
          provider: value.provider,
          kind: value.kind,
          query: value.query,
          version:
            value.kind !== "modpack" && instance
              ? instance.version
              : value.kind === "modpack"
                ? preset.minecraft
                : "",
          loader:
            value.kind !== "modpack" && instance
              ? instance.loader
              : value.kind === "modpack"
                ? preset.loader
                : "",
          offset: 0,
          limit: pageSize,
          sort,
        },
        value.instanceId,
        value.worldName,
      );
    },
  });
  useEffect(() => {
    form.setFieldValue("instanceId", selectedInstanceId);
    form.setFieldValue("worldName", "");
    setWorlds([]);
    if (!selectedInstanceId) return;
    let active = true;
    void window.electronAPI.content
      .inventory(selectedInstanceId)
      .then((result) => {
        if (active) setWorlds(result.data?.worlds ?? []);
      })
      .catch(() => {
        if (active) setError("Không đọc được world của instance.");
      });
    return () => {
      active = false;
    };
  }, [selectedInstanceId]);
  async function installSelected() {
    if (!selected || !searched) return false;
    setStatus({
      busy: true,
      message: "Đang chuẩn bị…",
      completed: 0,
      total: 0,
      logs: [],
    });
    const result = await execute(() =>
      window.electronAPI.content.install({
        query: searched,
        projectId: selected.id,
        versionId,
        ...(searched.kind !== "modpack" ? { instanceId: target } : {}),
        ...(searched.kind === "datapack" ? { worldName: targetWorld } : {}),
      }),
    );
    return result === null;
  }
  const busy = pending || status.busy || gameBusy;
  if (selected && searched && !installRequested)
    return (
      <ProjectDetail
        key={searched.provider + selected.id}
        project={selected}
        initialInstallOpen={installRequested}
        query={searched}
        versions={versions}
        versionId={versionId}
        setVersionId={setVersionId}
        busy={busy}
        pending={pending}
        status={status}
        targetName={instances.find((item) => item.id === target)?.name}
        onBack={() => setSelected(null)}
        onLibrary={onLibrary}
        hideWebview={hideWebview}
        onCancel={() =>
          void window.electronAPI.content
            .cancel()
            .catch(() => setError("Không hủy được tác vụ."))
        }
        onInstall={installSelected}
      />
    );
  const sidebarFilters = catalogMode || fixedKind === "modpack";
  const importButton = (
    <Button
      className="h-9"
      variant="outline"
      disabled={busy}
      onClick={() =>
        void execute(() => window.electronAPI.content.importPack())
      }
    >
      <Upload size={16} />
      Nhập .mrpack / .zip
    </Button>
  );
  const catalogSearch = (
    <form
      role="search"
      className="flex min-w-45 flex-1 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="query">
        {(field) => (
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Tìm kiếm pack"
              className="h-9 pl-9"
              maxLength={100}
              placeholder="Tìm kiếm pack…"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>
      <Button type="submit" size="icon" aria-label="Search" disabled={busy}>
        <Search />
      </Button>
    </form>
  );
  const introduction = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="text-lg font-semibold">
            Mod, modpack, shader, texture pack & data pack
          </h2>
          <p className="text-sm text-muted-foreground">
            Modrinth · CurseForge · quản lý và chỉ hiện file release phù hợp
            Minecraft/loader.
          </p>
        </div>
        {fixedKind !== "modpack" && importButton}
      </div>
      <p className="text-sm text-muted-foreground">
        Modpack tạo instance mới và giữ đúng loader trong manifest. Pack ngoài
        danh sách ổn định hoặc dùng Quilt sẽ bị từ chối. File client tùy chọn
        được bỏ qua. Chỉ cài nội dung từ tác giả bạn tin cậy.
      </p>
      {!configured && (
        <p className="hidden rounded-md border p-3 text-sm">
          Modrinth dùng ngay, không cần tài khoản. CurseForge cần cấu hình{" "}
          <code>CURSEFORGE_API_KEY</code> cho main process rồi khởi động lại.
          File bị tác giả chặn tải bên thứ ba sẽ được báo rõ, không tải qua
          nguồn thay thế.
        </p>
      )}
    </div>
  );
  return (
    <PageShell
      heading={
        fixedKind && !sidebarFilters ? (
          <PageHeading
            icon={contentIcons[fixedKind]}
            title={contentLabels[fixedKind]}
          />
        ) : undefined
      }
    >
      {fixedKind && !sidebarFilters && (
        <PageBanner
          image={
            fixedKind === "shader"
              ? shaderBackground
              : fixedKind === "resourcepack"
                ? resourceBackground
                : modsBackground
          }
        >
          {introduction}
        </PageBanner>
      )}
      {!fixedKind && <Card className="gap-4 p-4">{introduction}</Card>}
      <div
        className={
          sidebarFilters
            ? "grid min-w-0 items-start gap-6 lg:grid-cols-3"
            : "contents"
        }
      >
        <aside
          className={
            sidebarFilters
              ? "flex min-w-0 flex-col gap-6 lg:col-start-3 lg:row-start-1"
              : "contents"
          }
        >
          {sidebarFilters && (
            <PageHeading
              icon={catalogMode ? Package : contentIcons.modpack}
              title={catalogMode ? "Pack" : contentLabels.modpack}
            />
          )}
          {sidebarFilters && catalogSearch}
          <Card
            className={
              sidebarFilters
                ? "gap-0 p-4"
                : "contents border-0 bg-transparent p-0 shadow-none"
            }
          >
            <form
              aria-label={sidebarFilters ? "Filters" : undefined}
              className={sidebarFilters ? "min-w-0" : undefined}
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <fieldset
                disabled={busy}
                className={
                  sidebarFilters
                    ? "flex min-w-0 flex-col gap-4 [&_[data-slot=select-trigger]]:w-full [&_label]:before:content-[attr(aria-label)]"
                    : "flex flex-wrap items-end gap-2"
                }
              >
                {sidebarFilters && (
                  <div className="flex flex-col gap-1">
                    <CardTitle>Filters</CardTitle>
                    {catalogMode && (
                      <CardDescription>
                        {searched
                          ? `Kết quả: ${searched.provider} · ${searched.kind} · ${searched.loader || "Mọi mod loader"} ${searched.version || "· Mọi phiên bản"}`
                          : "Chọn nguồn và instance đích để tìm kiếm nội dung."}
                      </CardDescription>
                    )}
                  </div>
                )}
                <form.Field name="provider">
                  {(field) => (
                    <Field className="gap-1">
                      <FieldLabel htmlFor={`${filterId}-provider`}>
                        Nguồn
                      </FieldLabel>
                      <Select
                        items={[
                          { value: "curseforge", label: "CurseForge" },
                          { value: "modrinth", label: "Modrinth" },
                        ]}
                        value={field.state.value}
                        disabled={busy}
                        onValueChange={(selectedValue) => {
                          if (selectedValue === null) return;
                          field.handleChange(
                            String(selectedValue) as ContentProvider,
                          );
                        }}
                      >
                        <SelectTrigger
                          id={`${filterId}-provider`}
                          aria-label="Nguồn"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="curseforge">
                              CurseForge
                            </SelectItem>
                            <SelectItem value="modrinth">Modrinth</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                </form.Field>
                {!fixedKind && (
                  <form.Field name="kind">
                    {(field) => (
                      <label
                        aria-label="Loại"
                        className="flex flex-col gap-2 text-sm"
                      >
                        <Select
                          items={[
                            { value: "modpack", label: "Modpack" },
                            { value: "mod", label: "Mod" },
                            { value: "shader", label: "Shader" },
                            { value: "resourcepack", label: "Texture pack" },
                            { value: "datapack", label: "Data pack" },
                          ]}
                          value={field.state.value}
                          disabled={busy}
                          onValueChange={(selectedValue) => {
                            if (selectedValue === null) return;
                            field.handleChange(
                              String(selectedValue) as ContentKind,
                            );
                          }}
                        >
                          <SelectTrigger aria-label="Loại">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="modpack">Modpack</SelectItem>
                              <SelectItem value="mod">Mod</SelectItem>
                              <SelectItem value="shader">Shader</SelectItem>
                              <SelectItem value="resourcepack">
                                Texture pack
                              </SelectItem>
                              <SelectItem value="datapack">
                                Data pack
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </label>
                    )}
                  </form.Field>
                )}
                <form.Subscribe selector={(state) => state.values.kind}>
                  {(kind) =>
                    kind === "modpack" ? (
                      <form.Field name="preset">
                        {(field) => (
                          <label
                            aria-label="Minecraft / loader"
                            className="flex flex-col gap-2 text-sm"
                          >
                            <Select
                              items={loaderCatalog.map((entry, index) => ({
                                value: String(index),
                                label:
                                  entry.loader +
                                  " " +
                                  entry.minecraft +
                                  " · " +
                                  entry.version,
                              }))}
                              value={field.state.value}
                              disabled={busy}
                              onValueChange={(selectedValue) => {
                                if (selectedValue === null) return;
                                field.handleChange(String(selectedValue));
                              }}
                            >
                              <SelectTrigger aria-label="Minecraft / loader">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {loaderCatalog.map((entry, index) => (
                                    <SelectItem
                                      key={index}
                                      value={String(index)}
                                    >
                                      {entry.loader} {entry.minecraft} ·{" "}
                                      {entry.version}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </label>
                        )}
                      </form.Field>
                    ) : (
                      <form.Field name="instanceId">
                        {(field) => (
                          <Field className="gap-1">
                            <FieldLabel htmlFor={`${filterId}-instance`}>
                              Instance đích
                            </FieldLabel>
                            <Select
                              items={[
                                {
                                  value: "",
                                  label: "Chỉ duyệt · chưa chọn instance",
                                },
                                ...instances
                                  .filter(
                                    (item) =>
                                      (kind !== "mod" ||
                                        item.loader !== "Vanilla") &&
                                      (kind !== "shader" ||
                                        ["Fabric", "NeoForge"].includes(
                                          item.loader,
                                        )) &&
                                      supportedLoader(item),
                                  )
                                  .map((item) => ({
                                    value: item.id,
                                    label:
                                      item.name +
                                      " · " +
                                      item.loader +
                                      " " +
                                      item.version,
                                  })),
                              ]}
                              value={field.state.value}
                              disabled={busy}
                              onValueChange={(selectedValue) => {
                                if (selectedValue === null) return;
                                field.handleChange(String(selectedValue));
                                onInstanceChange?.(String(selectedValue));
                                setWorlds([]);
                                form.setFieldValue("worldName", "");
                              }}
                            >
                              <SelectTrigger
                                id={`${filterId}-instance`}
                                aria-label="Instance đích"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="">
                                    Chỉ duyệt · chưa chọn instance
                                  </SelectItem>
                                  {instances
                                    .filter(
                                      (item) =>
                                        (kind !== "mod" ||
                                          item.loader !== "Vanilla") &&
                                        (kind !== "shader" ||
                                          ["Fabric", "NeoForge"].includes(
                                            item.loader,
                                          )) &&
                                        supportedLoader(item),
                                    )
                                    .map((item) => (
                                      <SelectItem key={item.id} value={item.id}>
                                        {item.name} · {item.loader}{" "}
                                        {item.version}
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                        )}
                      </form.Field>
                    )
                  }
                </form.Subscribe>
                <form.Subscribe selector={(state) => state.values.kind}>
                  {(kind) =>
                    kind === "datapack" && (
                      <form.Field name="worldName">
                        {(field) => (
                          <label
                            aria-label="World"
                            className="flex flex-col gap-2 text-sm"
                          >
                            <Select
                              items={[
                                { value: "", label: "Chọn world" },
                                ...worlds.map((world) => ({
                                  value: world,
                                  label: world,
                                })),
                              ]}
                              value={field.state.value}
                              disabled={busy}
                              onValueChange={(selectedValue) => {
                                if (selectedValue === null) return;
                                field.handleChange(String(selectedValue));
                              }}
                            >
                              <SelectTrigger aria-label="World">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="">Chọn world</SelectItem>
                                  {worlds.map((world) => (
                                    <SelectItem key={world} value={world}>
                                      {world}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </label>
                        )}
                      </form.Field>
                    )
                  }
                </form.Subscribe>
                {!sidebarFilters && (
                  <form.Field name="query">
                    {(field) => (
                      <label
                        aria-label="Tìm kiếm"
                        className="flex flex-1 flex-col gap-2 text-sm"
                      >
                        <Input
                          aria-label="Tìm kiếm"
                          className="h-9"
                          maxLength={100}
                          placeholder="Sodium, JEI, All the Mods…"
                          value={field.state.value}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                        />
                      </label>
                    )}
                  </form.Field>
                )}
                {!sidebarFilters && (
                  <Button className="h-9" type="submit">
                    <Search size={16} />
                    Tìm kiếm
                  </Button>
                )}
                {!sidebarFilters && (
                  <>
                    {" "}
                    <Select
                      items={[
                        { value: "relevance", label: "Relevancy" },
                        { value: "downloads", label: "Downloads" },
                        { value: "updated", label: "Recently updated" },
                      ]}
                      value={sort}
                      disabled={busy}
                      onValueChange={(selectedValue) => {
                        if (selectedValue === null) return;
                        const value = String(selectedValue) as NonNullable<
                          ContentQuery["sort"]
                        >;
                        setSort(value);
                        if (searched)
                          void search(
                            { ...searched, sort: value, offset: 0 },
                            target,
                            targetWorld,
                          );
                      }}
                    >
                      <SelectTrigger
                        aria-label="Sort projects"
                        className="w-45"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="relevance">Relevancy</SelectItem>
                          <SelectItem value="downloads">Downloads</SelectItem>
                          <SelectItem value="updated">
                            Recently updated
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Select
                      items={[10, 20, 50].map((value) => ({
                        value,
                        label: String(value),
                      }))}
                      value={pageSize}
                      disabled={busy}
                      onValueChange={(selectedValue) => {
                        if (selectedValue === null) return;
                        const value = Number(String(selectedValue));
                        setPageSize(value);
                        if (searched)
                          void search(
                            { ...searched, limit: value, offset: 0 },
                            target,
                            targetWorld,
                          );
                      }}
                    >
                      <SelectTrigger
                        aria-label="Items per page"
                        className="w-15"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={10}>10</SelectItem>
                          <SelectItem value={20}>20</SelectItem>
                          <SelectItem value={50}>50</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <div
                      role="group"
                      aria-label="Project layout"
                      className="flex gap-2"
                    >
                      <Button
                        type="button"
                        size="icon"
                        variant={layout === "grid" ? "default" : "outline"}
                        aria-label="Vertical cards"
                        aria-pressed={layout === "grid"}
                        onClick={() => setLayout("grid")}
                      >
                        <LayoutGrid />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant={layout === "list" ? "default" : "outline"}
                        aria-label="Horizontal cards"
                        aria-pressed={layout === "list"}
                        onClick={() => setLayout("list")}
                      >
                        <List />
                      </Button>
                    </div>
                  </>
                )}{" "}
              </fieldset>
            </form>
          </Card>
        </aside>
        <div
          className={
            sidebarFilters
              ? "flex min-w-0 flex-col gap-6 lg:col-span-2 lg:col-start-1 lg:row-start-1"
              : "contents"
          }
        >
          {fixedKind === "modpack" && (
            <PageBanner image={modsBackground}>{introduction}</PageBanner>
          )}
          {catalogMode && (
            <div
              className="flex min-w-0 flex-wrap items-center gap-2"
              data-pack-search
            >
              {catalogTabs}
            </div>
          )}
          {sidebarFilters && (
            <div
              aria-label="Catalog controls"
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <Select
                  items={[
                    { value: "relevance", label: "Relevancy" },
                    { value: "downloads", label: "Downloads" },
                    { value: "updated", label: "Recently updated" },
                  ]}
                  value={sort}
                  disabled={busy}
                  onValueChange={(selectedValue) => {
                    if (selectedValue === null) return;
                    const value = String(selectedValue) as NonNullable<
                      ContentQuery["sort"]
                    >;
                    setSort(value);
                    if (searched)
                      void search(
                        { ...searched, sort: value, offset: 0 },
                        target,
                        targetWorld,
                      );
                  }}
                >
                  <SelectTrigger aria-label="Sort projects" className="w-45">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="relevance">Relevancy</SelectItem>
                      <SelectItem value="downloads">Downloads</SelectItem>
                      <SelectItem value="updated">Recently updated</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select
                  items={[10, 20, 50].map((value) => ({
                    value,
                    label: String(value),
                  }))}
                  value={pageSize}
                  disabled={busy}
                  onValueChange={(selectedValue) => {
                    if (selectedValue === null) return;
                    const value = Number(String(selectedValue));
                    setPageSize(value);
                    if (searched)
                      void search(
                        { ...searched, limit: value, offset: 0 },
                        target,
                        targetWorld,
                      );
                  }}
                >
                  <SelectTrigger aria-label="Items per page" className="w-15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={10}>10</SelectItem>
                      <SelectItem value={20}>20</SelectItem>
                      <SelectItem value={50}>50</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <div
                  role="group"
                  aria-label="Project pages"
                  className="flex items-center gap-2"
                >
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Previous page"
                    disabled={busy || !searched || searched.offset === 0}
                    onClick={() =>
                      searched &&
                      void search(
                        {
                          ...searched,
                          offset: Math.max(
                            0,
                            searched.offset - (searched.limit ?? 20),
                          ),
                        },
                        target,
                        targetWorld,
                      )
                    }
                  >
                    <ChevronLeft />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(
                      (searched?.offset ?? 0) / (searched?.limit ?? pageSize),
                    ) + 1}
                  </span>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Next page"
                    disabled={
                      busy ||
                      !searched ||
                      !results?.more ||
                      searched.offset + (searched.limit ?? 20) > 9900
                    }
                    onClick={() =>
                      searched &&
                      void search(
                        {
                          ...searched,
                          offset: searched.offset + (searched.limit ?? 20),
                        },
                        target,
                        targetWorld,
                      )
                    }
                  >
                    <ChevronRight />
                  </Button>
                </div>{" "}
                <div
                  role="group"
                  aria-label="Project layout"
                  className="flex gap-2"
                >
                  <Button
                    type="button"
                    size="icon"
                    variant={layout === "grid" ? "default" : "outline"}
                    aria-label="Vertical cards"
                    aria-pressed={layout === "grid"}
                    onClick={() => setLayout("grid")}
                  >
                    <LayoutGrid />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant={layout === "list" ? "default" : "outline"}
                    aria-label="Horizontal cards"
                    aria-pressed={layout === "list"}
                    onClick={() => setLayout("list")}
                  >
                    <List />
                  </Button>
                </div>
              </div>
            </div>
          )}
          {catalogMode && !results && !pending && (
            <p className="text-sm text-muted-foreground">
              Chọn bộ lọc và tìm kiếm nội dung để cài vào instance.
            </p>
          )}
          {!status.error && status.message && (
            <div
              role="status"
              className="flex flex-col gap-4 rounded-md border p-3"
            >
              <p className="text-sm">
                {status.message}{" "}
                {status.total > 0 && `${status.completed}/${status.total}`}
              </p>
              {status.total > 0 && (
                <Progress
                  aria-label="Tiến độ cài đặt nội dung"
                  className="w-full"
                  max={status.total}
                  value={status.completed}
                />
              )}
              {status.busy && (
                <Button
                  className="h-9"
                  variant="outline"
                  onClick={() =>
                    void window.electronAPI.content
                      .cancel()
                      .catch(() => setError("Không hủy được tác vụ."))
                  }
                >
                  Hủy tải nội dung
                </Button>
              )}
            </div>
          )}
          {pending && (
            <p role="status" className="text-sm">
              Đang xử lý…
            </p>
          )}
          {results && (
            <>
              <div
                className={
                  layout === "grid"
                    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
                    : "flex flex-col gap-4"
                }
              >
                {results.projects.map(
                  (project) =>
                    searched && (
                      <ContentProjectCard
                        key={project.id}
                        project={project}
                        query={searched}
                        layout={layout}
                        busy={busy}
                        onOpen={() => void openProject(project)}
                        onInstall={() => void openProject(project, true)}
                      />
                    ),
                )}
              </div>
              {!results.projects.length && (
                <p>Không tìm thấy nội dung phù hợp.</p>
              )}
              <div className={sidebarFilters ? "hidden" : "flex gap-2"}>
                <Button
                  className="h-9"
                  variant="outline"
                  disabled={busy || !searched || searched.offset === 0}
                  onClick={() =>
                    searched &&
                    void search(
                      {
                        ...searched,
                        offset: Math.max(
                          0,
                          searched.offset - (searched.limit ?? 20),
                        ),
                      },
                      target,
                      targetWorld,
                    )
                  }
                >
                  Trang trước
                </Button>
                <Button
                  className="h-9"
                  variant="outline"
                  disabled={
                    busy ||
                    !results.more ||
                    (searched?.offset ?? 0) + (searched?.limit ?? 20) > 9900
                  }
                  onClick={() =>
                    searched &&
                    void search(
                      {
                        ...searched,
                        offset: searched.offset + (searched.limit ?? 20),
                      },
                      target,
                      targetWorld,
                    )
                  }
                >
                  Trang sau
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      {selected && searched && installRequested && (
        <ContentInstallDialog
          key={searched.provider + selected.id}
          open
          onClose={() => {
            setSelected(null);
            setInstallRequested(false);
          }}
          project={selected}
          pack={searched.kind === "modpack"}
          targetName={instances.find((item) => item.id === target)?.name}
          versions={versions}
          versionId={versionId}
          setVersionId={setVersionId}
          busy={busy}
          pending={pending}
          status={status}
          onInstall={installSelected}
          onCancel={() =>
            void window.electronAPI.content
              .cancel()
              .catch(() => setError("Không hủy được tác vụ."))
          }
          onDone={onLibrary}
        />
      )}
    </PageShell>
  );
}
