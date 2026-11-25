import { Fragment, type Dispatch, type SetStateAction } from "react";
import { useForm } from "@gorth-com/primitive/cores/tanstack/form";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-com/primitive/default/card";
import { Separator } from "@gorth-com/primitive/default/separator";
import { Input } from "@gorth-com/primitive/default/input";
import { Textarea } from "@gorth-com/primitive/default/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@gorth-com/primitive/custom/tabs";
import { Button } from "@gorth-com/primitive/custom/button";
import { InstanceSelect } from "@/components/element/instance-select";
import { GameOption, GameToggle } from "../game-options";
import {
  minecraftPreferences,
  minecraftPreferencesSchema,
} from "@/lib/library/game-preferences";
import type { Settings } from "@/utils/interface";
import { toast } from "@/providers/toaster";
const toggles = [
  {
    key: "maximized",
    title: "Start Minecraft maximized",
    description:
      "Opens a window sized to the display work area; fullscreen instance overrides take priority.",
  },
  {
    key: "hideLauncher",
    title: "When the game window opens, hide the launcher",
  },
  {
    key: "quitLauncher",
    title: "When the game window closes, quit the launcher",
    description: "Waits until there are no other launcher game tasks.",
  },
  {
    key: "consoleOnLaunch",
    title: "When the game is launched, show the console window",
  },
  {
    key: "consoleOnCrash",
    title: "When the game crashes, show the console window",
  },
  {
    key: "hideConsoleOnExit",
    title: "When the game quits, hide the console window",
  },
  { key: "showGameTime", title: "Show time spent playing instances" },
  { key: "recordGameTime", title: "Record time spent playing instances" },
  {
    key: "showTotalTime",
    title: "Show the total time played across instances",
  },
  { key: "durationsInHours", title: "Always show durations in hours" },
] as const;
export function MinecraftSettings({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
}) {
  const initial = minecraftPreferences(settings);
  const form = useForm({
    defaultValues: {
      preferences: initial,
      environment: Object.entries(initial.environment)
        .map(([key, value]) => key + "=" + value)
        .join("\n"),
    },
    onSubmit: ({ value }) => {
      const environment: Record<string, string> = {};
      for (const line of value.environment.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const index = line.indexOf("=");
        if (index < 1) {
          toast.add({
            title: "Environment variables must use KEY=value",
            type: "error",
          });
          return;
        }
        environment[line.slice(0, index).trim()] = line.slice(index + 1);
      }
      const result = minecraftPreferencesSchema.safeParse({
        ...value.preferences,
        environment,
      });
      if (!result.success) {
        toast.add({
          title: "Invalid Minecraft settings",
          description: result.error.issues[0]?.message,
          type: "error",
        });
        return;
      }
      setSettings((previous) => ({ ...previous, minecraft: result.data }));
      toast.add({ title: "Minecraft preferences updated", type: "info" });
    },
  });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="preferences">
        {(field) => {
          const value = field.state.value;
          const set = (next: Partial<typeof value>) =>
            field.handleChange({ ...value, ...next });
          return (
            <Tabs defaultValue="general">
              <TabsList className="flex h-auto flex-wrap">
                <TabsTrigger className="h-9" value="general">
                  General
                </TabsTrigger>
                <TabsTrigger className="h-9" value="tweaks">
                  Tweaks
                </TabsTrigger>
                <TabsTrigger className="h-9" value="commands">
                  Custom Commands
                </TabsTrigger>
                <TabsTrigger className="h-9" value="environment">
                  Environment Variables
                </TabsTrigger>
              </TabsList>
              <TabsContent value="general">
                <Card className="gap-0 overflow-hidden py-0">
                  <GameOption
                    title="Ely.by patch"
                    description="Gorth accounts always retain their own authentication integration. This does not enable Ely.by account sign-in."
                  >
                    <InstanceSelect
                      label="Ely.by patch"
                      value={value.elyPatch}
                      items={[
                        { value: "never", label: "Never" },
                        {
                          value: "eligible",
                          label: "When using Ely.by or Offline account only",
                        },
                        {
                          value: "always",
                          label:
                            "Always, unless an account requires its own integration",
                        },
                      ]}
                      onChange={(next) => {
                        if (
                          next === "never" ||
                          next === "eligible" ||
                          next === "always"
                        )
                          set({ elyPatch: next });
                      }}
                    />
                  </GameOption>
                  <Separator />
                  <GameOption title="Window size">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label="Minecraft window width"
                        className="w-28"
                        type="number"
                        min={320}
                        max={16384}
                        value={value.windowWidth}
                        onChange={(event) =>
                          set({ windowWidth: Number(event.target.value) })
                        }
                      />
                      <span>×</span>
                      <Input
                        aria-label="Minecraft window height"
                        className="w-28"
                        type="number"
                        min={240}
                        max={16384}
                        value={value.windowHeight}
                        onChange={(event) =>
                          set({ windowHeight: Number(event.target.value) })
                        }
                      />
                    </div>
                  </GameOption>
                  {toggles.map((item) => (
                    <Fragment key={item.key}>
                      <Separator />
                      <GameToggle
                        title={item.title}
                        description={
                          "description" in item ? item.description : undefined
                        }
                        checked={value[item.key]}
                        onChange={(checked) => set({ [item.key]: checked })}
                      />
                    </Fragment>
                  ))}
                </Card>
              </TabsContent>
              <TabsContent value="tweaks">
                <Card className="gap-0 overflow-hidden py-0">
                  <GameOption title="GPU preference">
                    <InstanceSelect
                      label="Default GPU preference"
                      value={value.gpuPreference}
                      items={[
                        { value: "default", label: "System default" },
                        {
                          value: "high-performance",
                          label: "High performance",
                        },
                        { value: "integrated", label: "Integrated" },
                      ]}
                      onChange={(next) => {
                        if (
                          next === "default" ||
                          next === "high-performance" ||
                          next === "integrated"
                        )
                          set({ gpuPreference: next });
                      }}
                    />
                  </GameOption>
                  {(["openGlPath", "openAlPath", "glfwPath"] as const).map(
                    (key) => (
                      <Fragment key={key}>
                        <Separator />
                        <GameOption
                          title={
                            {
                              openGlPath: "OpenGL library",
                              openAlPath: "OpenAL library",
                              glfwPath: "GLFW library",
                            }[key]
                          }
                        >
                          <Input
                            aria-label={key}
                            value={value[key]}
                            onChange={(event) =>
                              set({ [key]: event.target.value })
                            }
                          />
                        </GameOption>
                      </Fragment>
                    ),
                  )}
                </Card>
              </TabsContent>
              <TabsContent value="commands">
                <Card className="gap-0 py-0">
                  <GameOption title="Pre-launch command">
                    <Input
                      aria-label="Default pre-launch command"
                      value={value.preLaunchCommand}
                      onChange={(event) =>
                        set({ preLaunchCommand: event.target.value })
                      }
                    />
                  </GameOption>
                  <Separator />
                  <GameOption title="Post-exit command">
                    <Input
                      aria-label="Default post-exit command"
                      value={value.postExitCommand}
                      onChange={(event) =>
                        set({ postExitCommand: event.target.value })
                      }
                    />
                  </GameOption>
                  <div className="p-4">
                    <CardDescription>
                      Commands execute directly without a shell. Instance
                      commands override defaults. Only configure programs you
                      trust.
                    </CardDescription>
                  </div>
                </Card>
              </TabsContent>
              <TabsContent value="environment">
                <Card className="p-4">
                  <CardTitle>Environment Variables</CardTitle>
                  <CardDescription>
                    One KEY=value per line. Instance values override defaults;
                    Java injection variables remain filtered.
                  </CardDescription>
                  <form.Field name="environment">
                    {(entry) => (
                      <Textarea
                        aria-label="Default environment variables"
                        rows={8}
                        value={entry.state.value}
                        onChange={(event) =>
                          entry.handleChange(event.target.value)
                        }
                      />
                    )}
                  </form.Field>
                </Card>
              </TabsContent>
            </Tabs>
          );
        }}
      </form.Field>
      <CardDescription>
        These defaults apply to instances without saved overrides. Per-instance
        Java, memory, window and native-library overrides remain in the instance
        editor.
      </CardDescription>
      <div className="flex gap-2">
        <Button type="submit">Save Minecraft settings</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            form.reset({
              preferences: minecraftPreferences({ memory: 4, javaPath: "" }),
              environment: "",
            })
          }
        >
          Reset Minecraft settings
        </Button>
      </div>
    </form>
  );
}
