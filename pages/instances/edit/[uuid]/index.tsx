import { useEffect, useState } from "react";
import { cn } from "@gorth-com/primitive/cores/cn";
import {
  Download,
  Trash2,
  Image,
  Link,
  FolderOpen,
} from "@gorth-com/primitive/cores/lucide";
import { Button } from "@gorth-com/primitive/custom/button";
import { Input } from "@gorth-com/primitive/default/input";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
  CardHeader,
} from "@gorth-com/primitive/default/card";
import { Separator } from "@gorth-com/primitive/default/separator";
import {
  InstanceWorkspace,
  type InstanceWorkspaceProps,
} from "@/layouts/instance-workspace";
import { InstanceSelect } from "@/components/element/instance-select";
import { InstanceNameForm } from "@/components/form/instance-name-form";
import { ModpackOverviewCard } from "@/components/element/modpack-overview";
import { InstanceSettingsForm } from "@/components/form/instance-settings-form";
import { InstanceDataPage } from "@/pages/instances/data";
import { InstalledContentManager } from "@/pages/content/installed-content";
import { ConsolePage } from "@/pages/console";
import { InstanceIcon } from "@/utils/renderer";
import { PageHeading } from "@/components/heading";
import { instanceEditSections, loaderCatalog } from "@/utils/constant";
import { supportedLoader } from "@/lib/game/catalog";
import { DataTable, dataTableFeatures } from "@/components/custom/data-table";
import type { ColumnDef } from "@gorth-com/primitive/cores/tanstack/table";
import { Checkbox } from "@gorth-com/primitive/default/checkbox";
import { confirmAction } from "@/lib/confirmation";
import { toast } from "@/providers/toaster";
import type { useLibrary } from "@/hooks/use-library";
import type { useGame } from "@/hooks/use-game";
import type { useAuth } from "@/hooks/use-auth";
import type { Instance, RuntimeComponent } from "@/utils/interface";

const runtimeColumns: ColumnDef<typeof dataTableFeatures, RuntimeComponent>[] =
  [
    {
      id: "enabled",
      header: "",
      enableSorting: false,
      cell: () => (
        <Checkbox checked disabled aria-label="Required runtime component" />
      ),
    },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "version", header: "Version" },
  ];
const runtimeSearchText = (item: RuntimeComponent) =>
  item.name + " " + item.version;
function RuntimeEditor({
  instance,
  library,
  gaming,
}: {
  instance: Instance;
  library: ReturnType<typeof useLibrary>;
  gaming: ReturnType<typeof useGame>;
}) {
  const [version, setVersion] = useState(instance.version);
  const [loader, setLoader] = useState(instance.loader);
  const [loaderVersion, setLoaderVersion] = useState(
    instance.loaderVersion ?? "",
  );
  const busy = library.busy || !!gaming.game.activeId;
  const [components, setComponents] = useState<RuntimeComponent[]>([]);
  const [revision, setRevision] = useState(0);
  const phase = gaming.game.jobs.find(
    (job) => job.instanceId === instance.id,
  )?.phase;
  useEffect(() => {
    let active = true;
    window.electronAPI.game.components(instance.id).then(
      (items) => {
        if (active) setComponents(items);
      },
      () => {
        if (active)
          toast.add({
            title: "Không đọc được thành phần runtime.",
            type: "error",
          });
      },
    );
    return () => {
      active = false;
    };
  }, [
    instance.id,
    instance.version,
    instance.loader,
    instance.loaderVersion,
    phase,
    revision,
  ]);
  return (
    <div
      data-runtime-components
      className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3"
    >
      <div className="min-w-0 lg:col-span-2">
        <DataTable
          data={components}
          columns={runtimeColumns}
          getSearchText={runtimeSearchText}
          searchLabel="Search runtime components…"
          emptyLabel="Chưa có thành phần runtime."
        />
      </div>
      <Card className="h-fit gap-4 p-4">
        <CardContent className="flex flex-col gap-4 p-0">
          <CardTitle>Minecraft &amp; mod loader</CardTitle>
          <InstanceSelect
            label="Minecraft version"
            disabled={busy}
            value={version}
            onChange={(value) => {
              setVersion(value);
              setLoader("Vanilla");
              setLoaderVersion("");
            }}
            items={[
              ...new Set([
                instance.version,
                ...gaming.versions.map((item) => item.id),
              ]),
            ].map((value) => ({ label: value, value }))}
          />
          <InstanceSelect
            label="Mod loader"
            disabled={busy}
            value={loader + ":" + loaderVersion}
            onChange={(value) => {
              const [next, nextVersion = ""] = value.split(":");
              setLoader(next);
              setLoaderVersion(nextVersion);
            }}
            items={[
              { value: "Vanilla:", label: "Vanilla" },
              ...loaderCatalog
                .filter((item) => item.minecraft === version)
                .map((item) => ({
                  value: item.loader + ":" + item.version,
                  label: item.loader + " " + item.version,
                })),
            ]}
          />
          <CardDescription>
            Đổi runtime giữ nguyên saves, mods và config. Bạn cần tải lại
            game/loader.
          </CardDescription>
          <div>
            <Button
              disabled={
                busy ||
                !supportedLoader({
                  version,
                  loader,
                  loaderVersion: loaderVersion || null,
                })
              }
              onClick={async () => {
                if (
                  !(await confirmAction({
                    title: "Đổi runtime?",
                    description:
                      "Game/loader sẽ được tải lại, giữ nguyên saves, mods và config.",
                  }))
                )
                  return;
                if (
                  await library.run({
                    action: "runtime",
                    id: instance.id,
                    version,
                    loader,
                    loaderVersion: loaderVersion || null,
                  })
                )
                  toast.add({ title: "Đã đổi runtime.", type: "success" });
              }}
            >
              Save runtime
            </Button>
          </div>
          <Separator />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void gaming.run({ action: "install", instance })}
          >
            <Download data-icon="inline-start" /> Download all
          </Button>
          <Button
            variant="outline"
            onClick={() => setRevision((value) => value + 1)}
          >
            Reload
          </Button>
          <Button
            variant="outline"
            onClick={() => void gaming.openDirectory(instance.id)}
          >
            <FolderOpen data-icon="inline-start" /> Open .minecraft
          </Button>
          <Separator />
          <CardDescription>
            Thành phần runtime bắt buộc không thể tắt hoặc đổi thứ tự. Các thao
            tác tùy biến bên dưới chưa được hỗ trợ.
          </CardDescription>
          {[
            "Move Up",
            "Move Down",
            "Remove",
            "Customize",
            "Edit",
            "Revert",
            "Add to Minecraft.jar",
            "Replace Minecraft.jar",
            "Add Agents",
            "Add Empty",
            "Import Components",
          ].map((label) => (
            <Button key={label} variant="outline" disabled>
              {label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
export function EditInstancePage(
  props: InstanceWorkspaceProps & {
    id: string;
    library: ReturnType<typeof useLibrary>;
    gaming: ReturnType<typeof useGame>;
    authentication: ReturnType<typeof useAuth>;
    initialSection?: string;
    onSectionChange?: (section: string) => void;
    onInstanceChange?: (id: string, section: string) => void;
    onBrowseContent?: (page: "mods" | "resourcepacks" | "shaders") => void;
  },
) {
  const { library, gaming, authentication } = props;
  const [section, setSection] = useState(
    instanceEditSections.some((item) => item.id === props.initialSection)
      ? props.initialSection!
      : "overview",
  );
  const instance = library.instances.find((item) => item.id === props.id);
  const [group, setGroup] = useState(instance?.group ?? "");
  const busy = library.busy || !!gaming.game.activeId;
  async function nativeAction(action: () => Promise<unknown>) {
    try {
      await action();
    } catch (error) {
      toast.add({
        title: error instanceof Error ? error.message : "Thao tác thất bại.",
        type: "error",
      });
    }
  }
  const activeSection = instanceEditSections.find(
    (item) => item.id === section,
  )!;
  return (
    <InstanceWorkspace
      {...props}
      sections={instanceEditSections}
      section={section}
      fillContent={section === "console" || section === "logs"}
      onSectionChange={(next) => {
        setSection(next);
        props.onSectionChange?.(next);
      }}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-6",
          (section === "console" || section === "logs") && "min-h-0 flex-1",
        )}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
          <PageHeading
            title={instance ? activeSection.title : "Instance not found"}
            icon={activeSection.icon}
          />
          <div className="w-60 max-w-full">
            <InstanceSelect
              label="Switch instance"
              value={instance?.id ?? ""}
              disabled={!library.instances.length}
              items={library.instances.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
              onChange={(id) => {
                if (id === instance?.id) return;
                if (props.onInstanceChange) props.onInstanceChange(id, section);
                else props.onNavigate(`instances/edit/${id}`);
              }}
            />
          </div>
        </div>
        {!instance ? (
          <Card>
            <CardContent className="flex flex-col gap-6">
              <CardDescription>
                Instance này không tồn tại hoặc đã nằm trong thùng rác.
              </CardDescription>
              <Button onClick={() => props.onNavigate("instances")}>
                Back to instances
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {section === "overview" && (
              <div className="flex min-w-0 flex-col gap-6">
                <Card>
                  <CardHeader className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-4">
                      <InstanceIcon data={instance.iconData} />
                      <div>
                        <CardTitle>{instance.name}</CardTitle>
                        <CardDescription>
                          Minecraft {instance.version} · {instance.loader}{" "}
                          {instance.loaderVersion}
                        </CardDescription>
                      </div>
                    </div>
                    <div></div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="flex flex-col gap-6">
                    <InstanceNameForm
                      key={instance.id + instance.name}
                      initialName={instance.name}
                      busy={busy}
                      onSave={async (name) => {
                        await library.run({
                          action: "rename",
                          id: instance.id,
                          name,
                        });
                      }}
                      onCopy={async (name) => {
                        if (
                          await library.run({
                            action: "copy",
                            id: instance.id,
                            name,
                          })
                        )
                          toast.add({
                            title: "Đã sao chép instance.",
                            type: "success",
                          });
                      }}
                    />
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      <Input
                        aria-label="Instance group"
                        className="min-w-40 flex-1"
                        maxLength={60}
                        placeholder="No group"
                        value={group}
                        onChange={(event) => setGroup(event.target.value)}
                      />
                      <Button
                        disabled={busy}
                        variant="outline"
                        onClick={() =>
                          void library.run({
                            action: "metadata",
                            id: instance.id,
                            group: group.trim() || null,
                          })
                        }
                      >
                        Save group
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void nativeAction(async () => {
                            const result =
                              await window.electronAPI.library.chooseIcon(
                                instance.id,
                              );
                            if (!result.ok) throw new Error(result.error);
                          })
                        }
                      >
                        <Image />
                        Choose icon
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy || !instance.iconData}
                        onClick={() =>
                          void library.run({
                            action: "icon",
                            id: instance.id,
                            iconData: null,
                          })
                        }
                      >
                        Reset icon
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void nativeAction(async () => {
                            const result =
                              await window.electronAPI.library.createShortcut(
                                instance.id,
                              );
                            if (!result.ok) throw new Error(result.error);
                            toast.add({
                              title: "Đã tạo shortcut.",
                              type: "success",
                            });
                          })
                        }
                      >
                        <Link />
                        Desktop shortcut
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void gaming.openDirectory(instance.id)}
                      >
                        <FolderOpen />
                        Open folder
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void nativeAction(async () => {
                            const result =
                              await window.electronAPI.instanceData.export(
                                instance.id,
                              );
                            if (!result.ok) throw new Error(result.error);
                            if (result.data)
                              toast.add({
                                title: "Đã xuất instance.",
                                type: "success",
                              });
                          })
                        }
                      >
                        <Download />
                        Export
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            (await confirmAction({
                              title: "Đưa " + instance.name + " vào thùng rác?",
                              destructive: true,
                              description:
                                "Bạn có thể khôi phục instance từ danh sách Instances.",
                            })) &&
                            (await library.run({
                              action: "delete",
                              id: instance.id,
                            }))
                          )
                            props.onNavigate("instances");
                        }}
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <ModpackOverviewCard
                  key={instance.id}
                  instanceId={instance.id}
                  instanceName={instance.name}
                  unavailable={busy}
                />
              </div>
            )}
            {section === "version" && (
              <RuntimeEditor
                key={instance.id + instance.version + instance.loader}
                instance={instance}
                library={library}
                gaming={gaming}
              />
            )}
            {section === "settings" &&
              library.instanceSettings[instance.id] && (
                <InstanceSettingsForm
                  key={instance.id}
                  instanceId={instance.id}
                  globalSettings={library.settings}
                  initialSettings={library.instanceSettings[instance.id]}
                  accounts={authentication.auth?.accounts ?? []}
                  busy={busy}
                  onOpenJava={() => props.onNavigate("settings/runtime")}
                  onSave={(settings) =>
                    library.run({
                      action: "instance.settings",
                      id: instance.id,
                      settings,
                    })
                  }
                />
              )}
            {["mod", "resourcepack", "shader"].includes(section) && (
              <div className="flex flex-col gap-6">
                <InstalledContentManager
                  key={instance.id + section}
                  instance={instance}
                  unavailable={busy}
                  kind={section as "mod" | "resourcepack" | "shader"}
                  toolbarActions={
                    <Button
                      variant="outline"
                      onClick={() => {
                        const page =
                          section === "mod"
                            ? "mods"
                            : section === "shader"
                              ? "shaders"
                              : "resourcepacks";
                        if (props.onBrowseContent) props.onBrowseContent(page);
                        else props.onNavigate(page);
                      }}
                    >
                      <Download />
                      Browse &amp; install
                    </Button>
                  }
                />
              </div>
            )}
            {["notes", "worlds", "servers", "screenshots", "logs"].includes(
              section,
            ) && (
              <InstanceDataPage
                key={instance.id + section}
                instances={[instance]}
                fixedInstanceId={instance.id}
                section={
                  section as
                    "notes" | "worlds" | "servers" | "screenshots" | "logs"
                }
                busy={busy}
                onChanged={() => {}}
              />
            )}
            {section === "console" && (
              <ConsolePage
                {...gaming}
                selectedInstanceId={instance.id}
                fixedInstance
                game={{
                  ...gaming.game,
                  jobs: gaming.game.jobs.filter(
                    (item) => item.instanceId === instance.id,
                  ),
                }}
                instances={[instance]}
              />
            )}
          </>
        )}
      </div>
    </InstanceWorkspace>
  );
}
