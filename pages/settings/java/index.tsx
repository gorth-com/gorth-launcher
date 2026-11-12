import { Fragment, useState, type Dispatch, type SetStateAction } from "react";
import { useForm } from "@gorth-io/primitive/cores/tanstack/form";
import { useQuery, useMutation } from "@gorth-io/primitive/cores/tanstack/query";
import {
  Card,
  CardTitle,
  CardDescription,
  CardHeader,
  CardContent,
} from "@gorth-io/primitive/default/card";
import { Separator } from "@gorth-io/primitive/default/separator";
import { Input } from "@gorth-io/primitive/default/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@gorth-io/primitive/default/dialog";
import { Field, FieldLabel } from "@gorth-io/primitive/default/field";
import { JavaInstallations } from "@/components/element/java-installations";
import { Textarea } from "@gorth-io/primitive/default/textarea";
import { RadioGroup, RadioGroupItem } from "@gorth-io/primitive/custom/radio";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@gorth-io/primitive/custom/tabs";
import { Button } from "@gorth-io/primitive/custom/button";
import { InstanceSelect } from "@/components/element/instance-select";
import { GameOption, GameToggle } from "../game-options";
import { toast } from "@/providers/toaster";
import {
  javaPreferences,
  javaPreferencesSchema,
  presetArguments,
} from "@/lib/library/game-preferences";
import type { Settings } from "@/utils/interface";
export function JavaSettings({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
}) {
  const [major, setMajor] = useState(17);
  const [detectTarget, setDetectTarget] = useState<"path" | "paths.17" | "paths.21" | "paths.25" | null>(null);
  const installed = useQuery({
    queryKey: ["java-installations"],
    queryFn: () => window.electronAPI.settings.javaInstallations(),
    staleTime: 60000,
    retry: false,
  });
  const refreshInstallations = async () => {
    const result = await installed.refetch();
    if (result.error) toast.add({ title: "Could not detect Java", type: "error" });
  };
  const form = useForm({
    defaultValues: {
      path: settings.javaPath,
      paths: { "17": settings.javaPaths?.["17"] ?? "", "21": settings.javaPaths?.["21"] ?? "", "25": settings.javaPaths?.["25"] ?? "" },
      preferences: javaPreferences(settings),
    },
    onSubmit: ({ value }) => {
      const parsed = javaPreferencesSchema.safeParse(value.preferences);
      if (!parsed.success) {
        toast.add({
          title: "Invalid Java settings",
          description: parsed.error.issues[0]?.message,
          type: "error",
        });
        return;
      }
      setSettings((previous) => ({
        ...previous,
        javaPath: value.path.trim(),
        javaPaths: { "17": value.paths["17"].trim(), "21": value.paths["21"].trim(), "25": value.paths["25"].trim() },
        memory: Math.ceil(parsed.data.memoryMaxMiB / 1024),
        java: parsed.data,
      }));
      toast.add({ title: "Java preferences updated", type: "info" });
    },
  });
  const choose = useMutation({
    mutationFn: async (field: NonNullable<typeof detectTarget>) => ({ field, file: await window.electronAPI.settings.chooseJava() }),
    onSuccess: ({ field, file }) => {
      if (file) form.setFieldValue(field, file);
    },
    onError: () => toast.add({ title: "Could not choose Java", type: "error" }),
  });
  const test = useMutation({
    mutationFn: () =>
      window.electronAPI.settings.testJava({
        path: ([17, 21, 25].includes(major) ? form.state.values.paths[String(major) as "17" | "21" | "25"] : "") || form.state.values.path,
        major,
        preferences: form.state.values.preferences,
      }),
    onSuccess: (value) =>
      toast.add({
        title: "Java settings passed",
        description:
          value.vendor + " " + value.version + " · " + value.architecture,
        type: "success",
      }),
    onError: () =>
      toast.add({
        title: "Java settings failed",
        description:
          "Check the executable, required Java version, collector support and memory limits.",
        type: "error",
      }),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="installations">Installations</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="flex flex-row justify-between gap-1 p-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Java installation</CardTitle>
                <CardDescription>
                  Automatic selection follows the Minecraft version. Downloads
                  use Mojang when enabled, otherwise Eclipse Temurin.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-4 pb-4">
              {([
                { field: "path", label: "Default Java executable" },
                { field: "paths.17", label: "Java 17 executable" },
                { field: "paths.21", label: "Java 21 executable" },
                { field: "paths.25", label: "Java 25 executable" },
              ] as const).map((item) => <form.Field key={item.field} name={item.field}>{(field) => (
                <Field className="gap-1">
                  <FieldLabel htmlFor={`java-${item.field}`}>{item.label}</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input className="min-w-0 flex-1" id={`java-${item.field}`} placeholder={item.field === "path" ? "Automatic runtime selection" : "Use default or automatic selection"} value={field.state.value} onChange={(event) => field.handleChange(event.target.value)} />
                    <Button type="button" variant="outline" onClick={() => { setDetectTarget(item.field); void refreshInstallations(); }}>Detect</Button>
                    <Button type="button" variant="outline" disabled={choose.isPending} onClick={() => choose.mutate(item.field)}>Browse</Button>
                  </div>
                </Field>
              )}</form.Field>)}
            </CardContent>
            <form.Field name="preferences">
              {(field) => {
                const value = field.state.value;
                const set = (next: Partial<typeof value>) =>
                  field.handleChange({ ...value, ...next });
                return (
                  <>
                    {(
                      [
                        {
                          key: "skipCompatibilityChecks",
                          title: "Skip Java compatibility checks",
                        },
                        {
                          key: "skipSetupPrompt",
                          title: "Skip Java setup prompt on startup",
                        },
                        {
                          key: "autoDetect",
                          title: "Auto-detect Java version",
                        },
                        {
                          key: "autoDownloadMojang",
                          title: "Auto-download Mojang Java",
                        },
                      ] as const
                    ).map((item) => (
                      <Fragment key={item.key}>
                        <Separator />
                        <GameToggle
                          title={item.title}
                          checked={value[item.key]}
                          onChange={(checked) => set({ [item.key]: checked })}
                        />
                      </Fragment>
                    ))}
                    <Separator />
                    <GameOption
                      title="Test settings"
                      description="Tests collector and custom JVM flags without allocating the configured heap."
                    >
                      <div className="flex gap-2">
                        <InstanceSelect
                          label="Required Java major version"
                          value={String(major)}
                          onChange={(next) => setMajor(Number(next))}
                          items={[8, 17, 21, 25].map((version) => ({
                            value: String(version),
                            label: "Java " + version,
                          }))}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={test.isPending}
                          onClick={() => test.mutate()}
                        >
                          Test settings
                        </Button>
                      </div>
                    </GameOption>
                    <Separator />
                    <GameOption title="Minimum memory usage (MiB)">
                      <Input
                        aria-label="Minimum memory usage (MiB)"
                        type="number"
                        min={128}
                        max={65536}
                        className="w-32"
                        value={value.memoryMinMiB}
                        onChange={(event) =>
                          set({ memoryMinMiB: Number(event.target.value) })
                        }
                      />
                    </GameOption>
                    <Separator />
                    <GameOption title="Maximum memory usage (MiB)">
                      <Input
                        id="memory"
                        aria-label="Maximum memory usage (MiB)"
                        type="number"
                        min={128}
                        max={65536}
                        className="w-32"
                        value={value.memoryMaxMiB}
                        onChange={(event) =>
                          set({ memoryMaxMiB: Number(event.target.value) })
                        }
                      />
                    </GameOption>
                    <Separator />
                    <GameOption
                      title="PermGen size (MiB)"
                      description="Legacy option. PermGen was removed in Java 8; no PermGen flag is passed to supported runtimes."
                    >
                      <Input
                        aria-label="PermGen size (MiB)"
                        disabled
                        type="number"
                        className="w-32"
                        value={value.permGenMiB}
                      />
                    </GameOption>
                    <Separator />
                    <GameToggle
                      title="Warn when there is not enough free memory"
                      checked={value.warnFreeMemory}
                      onChange={(checked) => set({ warnFreeMemory: checked })}
                    />
                    <Separator />
                    <GameToggle
                      title="Use Mojang optimized defaults"
                      checked={value.optimizedDefaults}
                      onChange={(checked) =>
                        set({ optimizedDefaults: checked })
                      }
                    />
                    <Separator />
                    <div className="flex flex-col gap-4 p-4">
                      <CardTitle>Garbage collector preset</CardTitle>
                      <RadioGroup
                        value={value.garbageCollector}
                        className="flex flex-col gap-4"
                        onValueChange={(next) => {
                          if (
                            next === "none" ||
                            next === "g1" ||
                            next === "shenandoah" ||
                            next === "zgc"
                          )
                            set({ garbageCollector: next });
                        }}
                      >
                        {[
                          { value: "none", label: "None" },
                          { value: "g1", label: "G1GC" },
                          { value: "shenandoah", label: "Shenandoah" },
                          { value: "zgc", label: "ZGC" },
                        ].map((item) => (
                          <label
                            key={item.value}
                            className="flex items-center gap-2"
                          >
                            <RadioGroupItem value={item.value} />
                            {item.label}
                          </label>
                        ))}
                      </RadioGroup>
                      <CardDescription>
                        Availability depends on the selected Java runtime. Use
                        Test settings before launching.
                      </CardDescription>
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-4 p-4">
                      <CardTitle>Java arguments chosen by launcher</CardTitle>
                      <Input
                        aria-label="Java arguments chosen by launcher"
                        readOnly
                        value={presetArguments({
                          ...value,
                          customArguments: [],
                        }).join(" ")}
                      />
                      <CardTitle>Custom Java arguments</CardTitle>
                      <CardDescription>
                        One argument per line; instance arguments are appended
                        after these.
                      </CardDescription>
                      <Textarea
                        aria-label="Custom Java arguments"
                        rows={4}
                        value={value.customArguments.join("\n")}
                        onChange={(event) =>
                          set({
                            customArguments: event.target.value.split("\n"),
                          })
                        }
                      />
                    </div>
                  </>
                );
              }}
            </form.Field>
          </Card>
        </TabsContent>
        <TabsContent value="installations">
          <Card className="gap-0 py-0">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <CardTitle>Installed Java runtimes</CardTitle>
            </div>
            <Separator />
            <div className="p-4"><JavaInstallations items={installed.data ?? []} loading={installed.isFetching}
              onRefresh={() => void refreshInstallations()}
              onSelect={(item) => { form.setFieldValue("path", item.path); toast.add({ title: "Default Java selected; save to apply", type: "info" }); }} /></div>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={detectTarget !== null} onOpenChange={(open) => { if (!open) setDetectTarget(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto scrollbar-none sm:max-w-4xl">
          <DialogHeader><DialogTitle>{detectTarget === "path" ? "Select default Java" : `Select Java ${detectTarget?.split(".")[1] ?? ""}`}</DialogTitle>
            <DialogDescription>Choose an installed runtime. Save Java settings to apply the selected path.</DialogDescription></DialogHeader>
          <JavaInstallations variant="dialog" key={detectTarget} items={installed.data ?? []} loading={installed.isFetching}
            major={detectTarget && detectTarget !== "path" ? Number(detectTarget.split(".")[1]) : undefined}
            onRefresh={() => void refreshInstallations()}
            onSelect={(item) => { if (detectTarget) form.setFieldValue(detectTarget, item.path); setDetectTarget(null); }} />
        </DialogContent>
      </Dialog>
      <div className="flex gap-2">
        <Button type="submit">Save Java settings</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            form.reset({
              path: "",
              paths: { "17": "", "21": "", "25": "" },
              preferences: javaPreferences({ memory: 4, javaPath: "" }),
            })
          }
        >
          Reset Java settings
        </Button>
      </div>
    </form>
  );
}
