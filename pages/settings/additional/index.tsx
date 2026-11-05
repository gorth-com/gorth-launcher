import { Fragment, type Dispatch, type SetStateAction } from "react";
import { useForm } from "@gorth-io/primitive/cores/tanstack/form";
import { useMutation } from "@gorth-io/primitive/cores/tanstack/query";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
import { Separator } from "@gorth-io/primitive/default/separator";
import { RadioGroup, RadioGroupItem } from "@gorth-io/primitive/custom/radio";
import { Input } from "@gorth-io/primitive/default/input";
import { Button } from "@gorth-io/primitive/custom/button";
import {
  FolderOpen,
  Search,
  ArrowUpRight,
} from "@gorth-io/primitive/cores/lucide";
import { InstanceSelect } from "@/components/element/instance-select";
import { toast } from "@/providers/toaster";
import type { Settings, Page } from "@/utils/interface";

interface SettingsProps {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
}
const toolNames = {
  textEditor: "Text editor",
  mcedit: "MCEdit",
  jprofiler: "JProfiler",
  visualvm: "VisualVM",
} as const;
export function GeneralSettings({
  settings,
  setSettings,
}: SettingsProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-4 p-4">
        <CardTitle>Instance sorting</CardTitle>
        <RadioGroup
          className="flex flex-col gap-4"
          value={settings.instanceSort ?? "name"}
          onValueChange={(value) => {
            if (value === "name" || value === "last-played")
              setSettings((previous) => ({ ...previous, instanceSort: value }));
          }}
        >
          <label className="flex items-center gap-2">
            <RadioGroupItem value="name" />
            By name
          </label>
          <label className="flex items-center gap-2">
            <RadioGroupItem value="last-played" />
            By last launched
          </label>
        </RadioGroup>
      </div>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Console history limit</CardTitle>
          <CardDescription>
            Maximum retained lines per game process, from 100 to 100,000.
          </CardDescription>
        </div>
        <Input
          type="number"
          aria-label="Console history limit"
          min={100}
          max={100000}
          className="w-32"
          value={settings.consoleLogLimit ?? 1000}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isInteger(value) && value >= 100 && value <= 100000)
              setSettings((previous) => ({
                ...previous,
                consoleLogLimit: value,
              }));
          }}
        />
      </div>
    </Card>
  );
}
export function LanguageSettings({ settings, setSettings }: SettingsProps) {
  const options = [
    { value: "system", label: "System default" },
    { value: "en", label: "English" },
    { value: "vi", label: "Tiếng Việt" },
  ];
  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Regional format</CardTitle>
          <CardDescription>
            Controls dates in Launch History. Full interface translation is not
            available yet.
          </CardDescription>
        </div>
        <InstanceSelect
          label="Regional format"
          value={settings.locale ?? "system"}
          items={options}
          onChange={(value) => {
            if (value === "system" || value === "en" || value === "vi")
              setSettings((previous) => ({ ...previous, locale: value }));
          }}
        />
      </div>
    </Card>
  );
}
export function ServicesSettings({
  onNavigate,
}: {
  onNavigate?: (page: Page) => void;
}) {
  const services = [
    {
      title: "Gorth SSO",
      description: "Manage the launcher session and sign-in browser.",
      page: "settings/profile",
    },
    {
      title: "Game accounts",
      description: "Gorth, Ely.by and local game profiles.",
      page: "accounts",
    },
    {
      title: "Modrinth and CurseForge",
      description:
        "Browse mods and modpacks through existing provider integrations.",
      page: "content",
    },
  ] as const;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      {services.map((service, index) => (
        <Fragment key={service.title}>
          {index > 0 && <Separator />}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex flex-col gap-1">
              <CardTitle>{service.title}</CardTitle>
              <CardDescription>{service.description}</CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => onNavigate?.(service.page)}
            >
              Manage
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </Fragment>
      ))}
    </Card>
  );
}
export function ToolsSettings({ settings, setSettings }: SettingsProps) {
  const choose = useMutation({
    mutationFn: window.electronAPI.settings.chooseTool,
    onError: () =>
      toast.add({ title: "Could not select executable", type: "error" }),
  });
  const check = useMutation({
    mutationFn: window.electronAPI.settings.checkTool,
    onSuccess: (valid) =>
      toast.add({
        title: valid
          ? "Executable is accessible"
          : "Executable not found or not executable",
        type: valid ? "success" : "error",
      }),
    onError: () =>
      toast.add({ title: "Could not check executable", type: "error" }),
  });
  const form = useForm({
    defaultValues: {
      textEditor: settings.toolPaths?.textEditor ?? "",
      mcedit: settings.toolPaths?.mcedit ?? "",
      jprofiler: settings.toolPaths?.jprofiler ?? "",
      visualvm: settings.toolPaths?.visualvm ?? "",
    },
    onSubmit: ({ value }) => {
      setSettings((previous) => ({ ...previous, toolPaths: value }));
      toast.add({ title: "Tool paths updated", type: "info" });
    },
  });
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-2 p-4">
        <CardTitle>External tools</CardTitle>
        <CardDescription>
          Save executable locations and check file access. Tools are not
          automatically launched or attached to Minecraft.
        </CardDescription>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        {(Object.keys(toolNames) as (keyof typeof toolNames)[]).map((key) => (
          <Fragment key={key}>
            <Separator />
            <form.Field name={key}>
              {(field) => (
                <div className="flex flex-col gap-4 p-4">
                  <CardTitle>{toolNames[key]}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      aria-label={toolNames[key] + " path"}
                      maxLength={4096}
                      className="min-w-40 flex-1"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={choose.isPending}
                      onClick={async () => {
                        const file = await choose
                          .mutateAsync()
                          .catch(() => null);
                        if (file) field.handleChange(file);
                      }}
                    >
                      <FolderOpen className="size-4" />
                      Browse
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!field.state.value || check.isPending}
                      onClick={() => check.mutate(field.state.value)}
                    >
                      <Search className="size-4" />
                      Check
                    </Button>
                  </div>
                </div>
              )}
            </form.Field>
          </Fragment>
        ))}
        <Separator />
        <div className="flex gap-2 p-4">
          <Button type="submit">Save paths</Button>
        </div>
      </form>
    </Card>
  );
}
