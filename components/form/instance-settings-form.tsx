import { ScrollArea, ScrollBar } from "@gorth-io/primitive/default/scroll-area";
import { useState, type ReactNode } from "react";
import { useForm } from "@gorth-io/primitive/cores/tanstack/form";
import {
  useMutation,
  useQuery,
} from "@gorth-io/primitive/cores/tanstack/query";
import { Button } from "@gorth-io/primitive/custom/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@gorth-io/primitive/custom/tabs";
import { RadioGroup, RadioGroupItem } from "@gorth-io/primitive/custom/radio";
import {
  Field,
  FieldLabel,
  FieldDescription,
} from "@gorth-io/primitive/default/field";
import { Input } from "@gorth-io/primitive/default/input";
import { Textarea } from "@gorth-io/primitive/default/textarea";
import { Dialog, DialogContent } from "@gorth-io/primitive/default/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@gorth-io/primitive/default/table";
import { InstanceSelect } from "@/components/element/instance-select";
import { JavaInstallations } from "@/components/element/java-installations";
import {
  OverrideCard,
  SettingInput,
  SettingToggle,
} from "./instance-setting-controls";
import { instanceOverrides } from "@/lib/library/instance-overrides";
import { instanceSettingsSchema } from "@/lib/library/instance-settings";
import {
  effectiveGameSettings,
  javaPreferences,
  minecraftPreferences,
  presetArguments,
  type JavaPreferences,
  type MinecraftPreferences,
} from "@/lib/library/game-preferences";
import { toast } from "@/providers/toaster";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import type {
  AccountView,
  InstanceSettings,
  Settings,
} from "@/utils/interface";

interface InstanceSettingsFormProps {
  initialSettings: InstanceSettings;
  globalSettings?: Settings;
  instanceId?: string;
  accounts: AccountView[];
  busy: boolean;
  onSave: (settings: InstanceSettings) => Promise<boolean>;
  onOpenJava?: () => void;
}

export function InstanceSettingsForm({
  initialSettings,
  globalSettings = { memory: 4, javaPath: "" },
  instanceId,
  accounts,
  busy,
  onSave,
  onOpenJava,
}: InstanceSettingsFormProps) {
  const [detectOpen, setDetectOpen] = useState(false);
  const [testMajor, setTestMajor] = useState(17);
  const [tab, setTab] = useState("general");
  const globalJava = javaPreferences(globalSettings);
  const globalMinecraft = minecraftPreferences(globalSettings);
  const form = useForm({
    defaultValues: {
      settings: {
        ...initialSettings,
        overrides: instanceOverrides(initialSettings),
        javaOptions: initialSettings.javaOptions ?? globalJava,
        minecraftOptions: initialSettings.minecraftOptions ?? globalMinecraft,
        nativeLibraries: initialSettings.nativeLibraries ?? {
          glfw: !!initialSettings.glfwPath,
          openAl: !!initialSettings.openAlPath,
          openGl: !!initialSettings.openGlPath,
        },
      },
      argumentsText: (initialSettings.overrides
        ? initialSettings.jvmArguments
        : [...globalJava.customArguments, ...initialSettings.jvmArguments]
      ).join("\n"),
      environmentRows: Object.entries(
        initialSettings.overrides
          ? initialSettings.environment
          : { ...globalMinecraft.environment, ...initialSettings.environment },
      ).map(([name, value]) => ({ name, value })),
      joinMode: initialSettings.joinWorld ? "world" : "server",
    },
    onSubmit: async ({ value }) => {
      try {
        const environment: Record<string, string> = {};
        for (const row of value.environmentRows) {
          if (!row.name && !row.value) continue;
          const name = row.name.trim();
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
            throw new Error("Tên biến môi trường không hợp lệ: " + name);
          if (Object.hasOwn(environment, name))
            throw new Error("Biến môi trường bị trùng: " + name);
          Object.defineProperty(environment, name, {
            value: row.value,
            enumerable: true,
            configurable: true,
          });
        }
        const next = instanceSettingsSchema.parse({
          ...value.settings,
          environment,
          jvmArguments: value.argumentsText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
          joinServer:
            value.joinMode === "server" ? value.settings.joinServer.trim() : "",
          joinWorld: value.joinMode === "world" ? value.settings.joinWorld : "",
        });
        if (next.overrides?.javaInstallation && !next.javaPath.trim())
          throw new Error(
            "Chọn Java executable hoặc tắt Java installation để kế thừa global.",
          );
        if (next.overrides?.autoJoin && !(next.joinServer || next.joinWorld))
          throw new Error("Chọn server hoặc world trước khi bật Auto-join.");
        if (next.overrides?.account && !next.accountId)
          throw new Error("Chọn tài khoản hoặc tắt Override default account.");
        if (await onSave(next))
          toast.add({ title: "Đã lưu cấu hình instance", type: "success" });
      } catch (error) {
        toast.add({
          title: "Không lưu được cấu hình",
          description:
            error instanceof Error ? error.message : "Cấu hình không hợp lệ.",
          type: "error",
        });
      }
    },
  });
  const installed = useQuery({
    queryKey: ["java-installations"],
    queryFn: () => window.electronAPI.settings.javaInstallations(),
    enabled: detectOpen,
    staleTime: 60_000,
    retry: false,
  });
  const refreshJava = async () => {
    const result = await installed.refetch();
    if (result.error) toast.add({ title: "Không dò được Java", type: "error" });
  };
  const worlds = useQuery({
    queryKey: ["instance-worlds", instanceId],
    queryFn: async () => {
      const result = await window.electronAPI.instanceData.snapshot(
        instanceId!,
      );
      if (!result.ok || !result.data)
        throw new Error(result.error ?? "Không đọc được worlds.");
      return result.data.worlds;
    },
    enabled: !!instanceId && tab === "general",
    staleTime: 30_000,
    retry: false,
  });
  useFeedbackToast(worlds.error?.message ?? "");
  const choose = useMutation({
    mutationFn: () => window.electronAPI.settings.chooseJava(),
    onSuccess: (file) => {
      if (file) form.setFieldValue("settings.javaPath", file);
    },
    onError: () =>
      toast.add({ title: "Không chọn được Java executable", type: "error" }),
  });
  const test = useMutation({
    mutationFn: () => {
      const values = form.state.values;
      const settings = effectiveGameSettings(globalSettings, {
        ...values.settings,
        jvmArguments: values.argumentsText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      });
      return window.electronAPI.settings.testJava({
        path:
          settings.javaPath ||
          settings.javaPaths?.[String(testMajor) as "17" | "21" | "25"] ||
          settings.javaPaths?.default ||
          "",
        major: testMajor,
        preferences: {
          ...settings.javaOptions!,
          customArguments: [
            ...settings.javaOptions!.customArguments,
            ...settings.jvmArguments,
          ],
        },
      });
    },
    onSuccess: (value) =>
      toast.add({
        title: "Java settings passed",
        description: `${value.vendor} ${value.version} · ${value.architecture}`,
        type: "success",
      }),
    onError: (error) =>
      toast.add({
        title: "Java settings failed",
        description: error.message,
        type: "error",
      }),
  });
  return (
    <form
      className="flex min-w-0 flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({
          values: state.values,
          submitting: state.isSubmitting,
        })}
      >
        {({ values, submitting }) => {
          const value = values.settings;
          const overrides = value.overrides;
          const set = (next: Partial<InstanceSettings>) =>
            form.setFieldValue("settings", (previous) => ({
              ...previous,
              ...next,
            }));
          const override = (key: keyof typeof overrides, checked: boolean) =>
            set({ overrides: { ...overrides, [key]: checked } });
          const java = value.javaOptions;
          const minecraft = value.minecraftOptions;
          const setJava = (next: Partial<JavaPreferences>) =>
            set({ javaOptions: { ...java, ...next } });
          const setMinecraft = (next: Partial<MinecraftPreferences>) =>
            set({ minecraftOptions: { ...minecraft, ...next } });
          const effective = effectiveGameSettings(globalSettings, value);
          const shownMinecraft = effective.minecraftOptions!;
          const shownJava = effective.javaOptions!;
          const card = (
            key: keyof typeof overrides,
            title: string,
            children: ReactNode,
          ) => (
            <OverrideCard
              title={title}
              checked={overrides[key]}
              onChange={(checked) => override(key, checked)}
            >
              {children}
            </OverrideCard>
          );
          const minecraftToggle = (
            key:
              | "maximized"
              | "hideLauncher"
              | "quitLauncher"
              | "consoleOnLaunch"
              | "consoleOnCrash"
              | "hideConsoleOnExit"
              | "showGameTime"
              | "recordGameTime",
            title: string,
          ) => (
            <SettingToggle
              title={title}
              checked={shownMinecraft[key]}
              onChange={(checked) => setMinecraft({ [key]: checked })}
            />
          );
          const rows = values.environmentRows;
          return (
            <>
              <fieldset disabled={busy || submitting} className="min-w-0">
                <Tabs
                  value={tab}
                  onValueChange={(next) => setTab(String(next))}
                  className="gap-6"
                >
                  <div className="flex items-center justify-between gap-4">
                    <ScrollArea className="h-12 min-w-0 flex-1">
                      <TabsList
                        aria-label="Instance settings"
                        className="min-w-max"
                      >
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="java">Java</TabsTrigger>
                        <TabsTrigger value="tweaks">Tweaks</TabsTrigger>
                        <TabsTrigger value="commands">
                          Custom Commands
                        </TabsTrigger>
                        <TabsTrigger value="environment">
                          Environment Variables
                        </TabsTrigger>
                      </TabsList>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                    <Button
                      type="submit"
                      className="shrink-0"
                      disabled={busy || submitting}
                    >
                      {submitting ? "Đang lưu…" : "Lưu cấu hình instance"}
                    </Button>
                  </div>
                  <TabsContent value="general" className="flex flex-col gap-6">
                    {card(
                      "elyPatch",
                      "Ely.by patch",
                      <Field className="gap-1">
                        <FieldLabel>
                          Download and apply Ely.by game patch
                        </FieldLabel>
                        <InstanceSelect
                          label="Ely.by patch policy"
                          value={shownMinecraft.elyPatch}
                          onChange={(elyPatch) =>
                            setMinecraft({
                              elyPatch:
                                elyPatch as MinecraftPreferences["elyPatch"],
                            })
                          }
                          items={[
                            { value: "never", label: "Never" },
                            {
                              value: "eligible",
                              label: "When using Ely.by or Offline account",
                            },
                            { value: "always", label: "Always" },
                          ]}
                        />
                        <FieldDescription>
                          Tài khoản Ely.by vẫn dùng authlib-injector theo yêu
                          cầu đăng nhập.
                        </FieldDescription>
                      </Field>,
                    )}
                    {card(
                      "gameWindow",
                      "Game window",
                      <>
                        {minecraftToggle(
                          "maximized",
                          "Start Minecraft maximized",
                        )}
                        <SettingToggle
                          title="Fullscreen"
                          checked={effective.fullscreen}
                          onChange={(fullscreen) => set({ fullscreen })}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <SettingInput
                            title="Width (pixels)"
                            type="number"
                            min={320}
                            max={16384}
                            value={effective.resolutionWidth}
                            onChange={(width) =>
                              set({ resolutionWidth: Number(width) })
                            }
                          />
                          <SettingInput
                            title="Height (pixels)"
                            type="number"
                            min={240}
                            max={16384}
                            value={effective.resolutionHeight}
                            onChange={(height) =>
                              set({ resolutionHeight: Number(height) })
                            }
                          />
                        </div>
                        {minecraftToggle(
                          "hideLauncher",
                          "Hide launcher when the game opens",
                        )}
                        {minecraftToggle(
                          "quitLauncher",
                          "Quit launcher when the game closes",
                        )}
                      </>,
                    )}
                    {card(
                      "consoleWindow",
                      "Console window",
                      <>
                        {minecraftToggle(
                          "consoleOnLaunch",
                          "Show console when the game launches",
                        )}
                        {minecraftToggle(
                          "consoleOnCrash",
                          "Show console when the game crashes",
                        )}
                        {minecraftToggle(
                          "hideConsoleOnExit",
                          "Hide console when the game quits",
                        )}
                      </>,
                    )}
                    <OverrideCard
                      title="Global Data Packs"
                      checked={false}
                      unsupported
                      description="Chưa hỗ trợ: cần xác định mod cung cấp datapack toàn cục và đường dẫn tương ứng."
                    />
                    {card(
                      "gameTime",
                      "Game time",
                      <>
                        {minecraftToggle(
                          "showGameTime",
                          "Show time playing this instance",
                        )}
                        {minecraftToggle(
                          "recordGameTime",
                          "Record time playing this instance",
                        )}
                      </>,
                    )}
                    {card(
                      "account",
                      "Override default account",
                      <Field className="gap-1">
                        <FieldLabel>Account</FieldLabel>
                        <InstanceSelect
                          label="Instance account"
                          value={value.accountId ?? ""}
                          onChange={(accountId) =>
                            set({ accountId: accountId || null })
                          }
                          items={[
                            { value: "", label: "Choose account" },
                            ...accounts.map((account) => ({
                              value: account.id,
                              label:
                                account.username + " · " + account.provider,
                            })),
                          ]}
                        />
                      </Field>,
                    )}
                    {card(
                      "autoJoin",
                      "Enable Auto-join",
                      <>
                        <RadioGroup
                          aria-label="Auto-join target"
                          value={values.joinMode}
                          onValueChange={(mode) =>
                            form.setFieldValue("joinMode", String(mode))
                          }
                        >
                          <label className="flex items-center gap-2">
                            <RadioGroupItem value="server" />
                            Server address
                          </label>
                          <label className="flex items-center gap-2">
                            <RadioGroupItem value="world" />
                            Singleplayer world
                          </label>
                        </RadioGroup>
                        {values.joinMode === "server" ? (
                          <SettingInput
                            title="Server address"
                            value={value.joinServer}
                            placeholder="play.example.net:25565"
                            onChange={(joinServer) => set({ joinServer })}
                          />
                        ) : (
                          <Field className="gap-1">
                            <FieldLabel>World</FieldLabel>
                            <InstanceSelect
                              label="Singleplayer world"
                              value={value.joinWorld}
                              disabled={worlds.isFetching}
                              onChange={(joinWorld) => set({ joinWorld })}
                              items={[
                                {
                                  value: "",
                                  label: worlds.isFetching
                                    ? "Loading worlds…"
                                    : "Choose world",
                                },
                                ...Array.from(
                                  new Set([
                                    ...(worlds.data ?? []).map(
                                      (world) => world.name,
                                    ),
                                    ...(value.joinWorld
                                      ? [value.joinWorld]
                                      : []),
                                  ]),
                                ).map((name) => ({ value: name, label: name })),
                              ]}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              disabled={!instanceId || worlds.isFetching}
                              onClick={() =>
                                void worlds.refetch().then((result) => {
                                  if (result.error)
                                    toast.add({
                                      title: "Không đọc được worlds",
                                      type: "error",
                                    });
                                })
                              }
                            >
                              Refresh worlds
                            </Button>
                          </Field>
                        )}
                      </>,
                    )}
                    <OverrideCard
                      title="Override Mod Download Loaders"
                      checked={false}
                      unsupported
                      description="Chưa hỗ trợ override ngoài catalog loader hiện tại. Nội dung vẫn được lọc theo loader của instance."
                    />
                  </TabsContent>
                  <TabsContent value="java" className="flex flex-col gap-6">
                    {card(
                      "javaInstallation",
                      "Java installation",
                      <>
                        <Field className="gap-1">
                          <FieldLabel htmlFor="instance-java-path">
                            Java executable
                          </FieldLabel>
                          <div className="flex gap-2">
                            <Input
                              id="instance-java-path"
                              className="min-w-0 flex-1"
                              value={
                                overrides.javaInstallation
                                  ? value.javaPath
                                  : globalSettings.javaPath
                              }
                              placeholder="Global version-specific or automatic runtime"
                              onChange={(event) =>
                                set({ javaPath: event.target.value })
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setDetectOpen(true);
                                void refreshJava();
                              }}
                            >
                              Detect
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={choose.isPending}
                              onClick={() => choose.mutate()}
                            >
                              Browse
                            </Button>
                          </div>
                        </Field>
                        <SettingToggle
                          title="Skip Java compatibility checks"
                          checked={shownJava.skipCompatibilityChecks}
                          onChange={(checked) =>
                            setJava({ skipCompatibilityChecks: checked })
                          }
                        />
                      </>,
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-45">
                        <InstanceSelect
                          label="Test Java major version"
                          value={String(testMajor)}
                          onChange={(major) => setTestMajor(Number(major))}
                          items={[8, 17, 21, 25].map((major) => ({
                            value: String(major),
                            label: `Test as Java ${major}`,
                          }))}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={test.isPending}
                        onClick={() => test.mutate()}
                      >
                        Test settings
                      </Button>
                      {onOpenJava && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onOpenJava}
                        >
                          Open Java settings
                        </Button>
                      )}
                    </div>
                    {card(
                      "memory",
                      "Memory",
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <SettingInput
                            title="Minimum memory (MiB) · -Xms"
                            type="number"
                            min={128}
                            max={65536}
                            value={effective.memoryMin * 1024}
                            onChange={(memory) =>
                              set({ memoryMin: Number(memory) / 1024 })
                            }
                          />
                          <SettingInput
                            title="Maximum memory (MiB) · -Xmx"
                            type="number"
                            min={128}
                            max={65536}
                            value={effective.memoryMax * 1024}
                            onChange={(memory) =>
                              set({ memoryMax: Number(memory) / 1024 })
                            }
                          />
                        </div>
                        <SettingInput
                          title="PermGen size (MiB, legacy value)"
                          type="number"
                          readOnly
                          value={shownJava.permGenMiB}
                        />
                        <p className="text-xs text-muted-foreground">
                          Java 8 trở lên đã bỏ PermGen; giá trị được lưu nhưng
                          không truyền cờ PermGen vào Java.
                        </p>
                        <SettingToggle
                          title="Warn when there is not enough free memory"
                          checked={shownJava.warnFreeMemory}
                          onChange={(warnFreeMemory) =>
                            setJava({ warnFreeMemory })
                          }
                        />
                      </>,
                    )}
                    {card(
                      "javaArguments",
                      "Java arguments",
                      <>
                        <SettingToggle
                          title="Use Mojang optimized defaults"
                          checked={shownJava.optimizedDefaults}
                          onChange={(optimizedDefaults) =>
                            setJava({ optimizedDefaults })
                          }
                        />
                        <Field className="gap-1">
                          <FieldLabel>Garbage collector preset</FieldLabel>
                          <RadioGroup
                            aria-label="Garbage collector preset"
                            value={shownJava.garbageCollector}
                            onValueChange={(collector) =>
                              setJava({
                                garbageCollector:
                                  collector as JavaPreferences["garbageCollector"],
                              })
                            }
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
                        </Field>
                        <SettingInput
                          title="Arguments chosen by launcher"
                          readOnly
                          value={presetArguments({
                            ...shownJava,
                            customArguments: [],
                          }).join(" ")}
                        />
                        <Field className="gap-1">
                          <FieldLabel htmlFor="instance-java-arguments">
                            Custom Java arguments
                          </FieldLabel>
                          <Textarea
                            id="instance-java-arguments"
                            rows={5}
                            value={
                              overrides.javaArguments
                                ? values.argumentsText
                                : globalJava.customArguments.join("\n")
                            }
                            onChange={(event) =>
                              form.setFieldValue(
                                "argumentsText",
                                event.target.value,
                              )
                            }
                          />
                          <FieldDescription>
                            Mỗi dòng một argument; không thêm -Xms/-Xmx (dùng
                            mục Memory).
                          </FieldDescription>
                        </Field>
                      </>,
                    )}
                  </TabsContent>
                  <TabsContent value="tweaks" className="flex flex-col gap-6">
                    <OverrideCard
                      title="Legacy tweaks · Enable online fixes"
                      checked={false}
                      unsupported
                      description="Chưa hỗ trợ: chưa có nguồn patch legacy và quy tắc tương thích được xác nhận."
                    />
                    {card(
                      "nativeLibraries",
                      "Native libraries",
                      <>
                        <Field className="gap-1">
                          <FieldLabel>GPU preference</FieldLabel>
                          <InstanceSelect
                            label="GPU preference"
                            value={effective.gpuPreference}
                            onChange={(gpuPreference) =>
                              set({
                                gpuPreference:
                                  gpuPreference as InstanceSettings["gpuPreference"],
                              })
                            }
                            items={[
                              { value: "default", label: "System default" },
                              {
                                value: "high-performance",
                                label: "High performance",
                              },
                              { value: "integrated", label: "Integrated" },
                            ]}
                          />
                        </Field>
                        {(
                          [
                            { key: "glfwPath", flag: "glfw", title: "GLFW" },
                            {
                              key: "openAlPath",
                              flag: "openAl",
                              title: "OpenAL",
                            },
                            {
                              key: "openGlPath",
                              flag: "openGl",
                              title: "OpenGL",
                            },
                          ] as const
                        ).map((item) => (
                          <div key={item.key} className="flex flex-col gap-2">
                            <SettingToggle
                              title={`Use system installation of ${item.title}`}
                              checked={
                                overrides.nativeLibraries
                                  ? value.nativeLibraries[item.flag]
                                  : !!effective[item.key]
                              }
                              onChange={(checked) =>
                                set({
                                  nativeLibraries: {
                                    ...value.nativeLibraries,
                                    [item.flag]: checked,
                                  },
                                })
                              }
                            />
                            <fieldset
                              disabled={!value.nativeLibraries[item.flag]}
                            >
                              <SettingInput
                                title={`${item.title} library path`}
                                value={value[item.key]}
                                onChange={(path) => set({ [item.key]: path })}
                              />
                            </fieldset>
                          </div>
                        ))}
                      </>,
                    )}
                  </TabsContent>
                  <TabsContent value="commands" className="flex flex-col gap-6">
                    {card(
                      "commands",
                      "Override global commands",
                      <>
                        <SettingInput
                          title="Pre-launch command"
                          value={effective.preLaunchCommand}
                          onChange={(preLaunchCommand) =>
                            set({ preLaunchCommand })
                          }
                        />
                        <SettingInput
                          title="Wrapper command"
                          value={value.wrapperCommand ?? ""}
                          placeholder='"/path/to/wrapper" --argument'
                          onChange={(wrapperCommand) => set({ wrapperCommand })}
                        />
                        <SettingInput
                          title="Post-exit command"
                          value={effective.postExitCommand}
                          onChange={(postExitCommand) =>
                            set({ postExitCommand })
                          }
                        />
                      </>,
                    )}
                    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                      <p>
                        Pre-launch chạy trước game; post-exit chạy sau khi game
                        kết thúc. Thư mục làm việc là thư mục game của instance.
                      </p>
                      <p>
                        Các lệnh nhận biến môi trường: INST_NAME, INST_ID,
                        INST_DIR, INST_MC_DIR, INST_JAVA. Wrapper nhận Java
                        executable và toàn bộ argument phía sau. Argument chứa
                        token không được sao chép vào biến môi trường.
                      </p>
                      <p>
                        Lệnh chạy trực tiếp, không qua shell. Dùng dấu nháy cho
                        đường dẫn có khoảng trắng; |, &amp;&amp;, &gt; và $VAR
                        không được diễn giải.
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent
                    value="environment"
                    className="flex flex-col gap-6"
                  >
                    {card(
                      "environment",
                      "Override global environment variables",
                      <>
                        <p className="text-sm text-muted-foreground">
                          Khi bật, danh sách này thay thế biến global do bạn cấu
                          hình. Danh sách rỗng sẽ xóa các biến global đó; biến
                          hệ thống vẫn do launcher quản lý.
                        </p>
                        <div className="flex justify-between gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={rows.length >= 64}
                            onClick={() =>
                              form.setFieldValue("environmentRows", [
                                ...rows,
                                { name: "", value: "" },
                              ])
                            }
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={!rows.length}
                            onClick={() =>
                              form.setFieldValue("environmentRows", [])
                            }
                          >
                            Clear
                          </Button>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead>
                                <span className="sr-only">Actions</span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((row, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <Input
                                    aria-label={`Variable name ${index + 1}`}
                                    value={row.name}
                                    onChange={(event) =>
                                      form.setFieldValue(
                                        "environmentRows",
                                        rows.map((item, i) =>
                                          i === index
                                            ? {
                                                ...item,
                                                name: event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    aria-label={`Variable value ${index + 1}`}
                                    value={row.value}
                                    onChange={(event) =>
                                      form.setFieldValue(
                                        "environmentRows",
                                        rows.map((item, i) =>
                                          i === index
                                            ? {
                                                ...item,
                                                value: event.target.value,
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    aria-label={`Remove variable ${index + 1}`}
                                    onClick={() =>
                                      form.setFieldValue(
                                        "environmentRows",
                                        rows.filter((_, i) => i !== index),
                                      )
                                    }
                                  >
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </>,
                    )}
                  </TabsContent>
                </Tabs>
              </fieldset>
            </>
          );
        }}
      </form.Subscribe>
      <Dialog open={detectOpen} onOpenChange={setDetectOpen}>
        <DialogContent className="w-full max-w-5xl max-h-[90dvh] overflow-hidden">
          <JavaInstallations
            key={String(detectOpen)}
            variant="dialog"
            title="Java installations"
            selectedPath={form.state.values.settings.javaPath}
            items={installed.data ?? []}
            loading={installed.isFetching}
            onRefresh={() => void refreshJava()}
            onSelect={(item) => {
              form.setFieldValue("settings.javaPath", item.path);
              setTestMajor(item.major);
              setDetectOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </form>
  );
}
