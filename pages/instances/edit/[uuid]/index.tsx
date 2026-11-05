import { useState } from "react";
import {
  Play,
  Square,
  Download,
  Trash2,
  Image,
  Link,
  FolderOpen,
} from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import { Input } from "@gorth-io/primitive/default/input";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
  CardHeader,
} from "@gorth-io/primitive/default/card";
import { Separator } from "@gorth-io/primitive/default/separator";
import {
  InstanceWorkspace,
  type InstanceWorkspaceProps,
} from "@/layouts/instance-workspace";
import { InstanceSelect } from "@/components/element/instance-select";
import { InstanceNameForm } from "@/components/form/instance-name-form";
import { InstanceSettingsForm } from "@/components/form/instance-settings-form";
import { InstanceDataPage } from "@/pages/instances/data";
import { InstalledContentManager } from "@/pages/content/installed-content";
import { ConsolePage } from "@/pages/console";
import { InstanceIcon } from "@/utils/renderer";
import { PageHeading } from "@/components/heading";
import { instanceEditSections, loaderCatalog } from "@/utils/constant";
import { supportedLoader } from "@/lib/game/catalog";
import { confirmAction } from "@/lib/confirmation";
import { toast } from "@/providers/toaster";
import type { useLibrary } from "@/hooks/use-library";
import type { useGame } from "@/hooks/use-game";
import type { useAuth } from "@/hooks/use-auth";
import type { Instance } from "@/utils/interface";
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
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
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
      </CardContent>
    </Card>
  );
}
export function EditInstancePage(
  props: InstanceWorkspaceProps & {
    id: string;
    library: ReturnType<typeof useLibrary>;
    gaming: ReturnType<typeof useGame>;
    authentication: ReturnType<typeof useAuth>;
    initialSection?: string;
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
  const job = gaming.game.jobs.find((item) => item.instanceId === props.id);
  const running =
    !!job &&
    [
      "queued",
      "checking",
      "downloading",
      "paused",
      "starting",
      "running",
      "stopping",
    ].includes(job.phase);
  const activeSection = instanceEditSections.find(
    (item) => item.id === section,
  )!;
  return (
    <InstanceWorkspace
      {...props}
      sections={instanceEditSections}
      section={section}
      onSectionChange={setSection}
    >
      <div className="flex flex-col gap-6">
        <PageHeading
          title={
            instance
              ? `${activeSection.title} · ${instance.name}`
              : "Instance not found"
          }
          icon={activeSection.icon}
        />
        {!instance ? (
          <Card>
            <CardContent className="flex flex-col gap-4">
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
                  <div>

                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="flex flex-col gap-4">
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
                  expanded
                  initialSettings={library.instanceSettings[instance.id]}
                  accounts={authentication.auth?.accounts ?? []}
                  busy={busy}
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
              <div className="flex flex-col gap-4">
                <div className="flex justify-end">
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
                </div>
                <InstalledContentManager
                  key={instance.id + section}
                  instance={instance}
                  unavailable={busy}
                  kind={section as "mod" | "resourcepack" | "shader"}
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
                  onChanged={() => { }}
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
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Button variant="outline" onClick={props.onBack}>
                Close
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => props.onNavigate("downloads")}
                >
                  Progress &amp; downloads
                </Button>
                {running ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void gaming.run({
                        action: job?.phase === "running" ? "stop" : "cancel",
                        id: instance.id,
                      })
                    }
                  >
                    <Square />
                    Stop / Cancel
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy || !supportedLoader(instance)}
                      onClick={() =>
                        void gaming.run({ action: "install", instance })
                      }
                    >
                      <Download />
                      Download game
                    </Button>
                    <Button
                      disabled={
                        busy ||
                        !supportedLoader(instance) ||
                        (!authentication.auth?.selectedAccountId &&
                          !library.instanceSettings[instance.id]?.accountId)
                      }
                      onClick={() =>
                        void gaming.run({ action: "play", instance })
                      }
                    >
                      <Play />
                      Launch
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </InstanceWorkspace>
  );
}
