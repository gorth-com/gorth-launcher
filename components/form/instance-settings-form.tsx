import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { useState } from "react";
import { InstanceSelect } from "@/components/element/instance-select";
import { Switch } from "@gorth-io/primitive/default/switch";
import { Button } from "@gorth-io/primitive/custom/button";
import { Input } from "@gorth-io/primitive/default/input";
import { Textarea } from "@gorth-io/primitive/default/textarea";
import type { AccountView, InstanceSettings } from "@/utils/interface";

interface InstanceSettingsFormProps {
  expanded?: boolean;
  initialSettings: InstanceSettings;
  accounts: AccountView[];
  busy: boolean;
  onSave: (settings: InstanceSettings) => Promise<boolean>;
}

function environmentText(environment: Record<string, string>) {
  return Object.entries(environment)
    .map(([key, value]) => key + "=" + value)
    .join("\n");
}

function parseEnvironment(value: string) {
  const result: Record<string, string> = {};
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf("=");
    if (separator < 1)
      throw new Error("Biến môi trường phải có dạng KEY=value.");
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      throw new Error("Tên biến môi trường không hợp lệ: " + key);
    result[key] = line.slice(separator + 1);
  }
  return result;
}

export function InstanceSettingsForm({
  initialSettings,
  accounts,
  busy,
  onSave,
  expanded = false,
}: InstanceSettingsFormProps) {
  const [value, setValue] = useState(initialSettings);
  const [jvmArguments, setJvmArguments] = useState(
    initialSettings.jvmArguments.join("\n"),
  );
  const [environment, setEnvironment] = useState(
    environmentText(initialSettings.environment),
  );
  const [error, setError] = useState("");
  useFeedbackToast(error);
  const field = (
    key: keyof InstanceSettings,
    next: string | number | boolean | null,
  ) => setValue((current) => ({ ...current, [key]: next }));
  const save = async () => {
    setError("");
    try {
      const next = {
        ...value,
        jvmArguments: jvmArguments
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
        environment: parseEnvironment(environment),
      };
      if (next.memoryMin > next.memoryMax)
        throw new Error("RAM tối thiểu không được lớn hơn RAM tối đa.");
      if (next.joinServer && next.joinWorld)
        throw new Error("Chỉ chọn server hoặc world để vào trực tiếp.");
      if (await onSave(next)) setValue(next);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Cấu hình không hợp lệ.",
      );
    }
  };

  return (
    <details
      open={expanded || undefined}
      className="mt-5 rounded-lg border p-4"
    >
      <summary className="cursor-pointer text-sm font-medium">
        Cấu hình riêng của instance
      </summary>
      <fieldset disabled={busy} className="mt-3 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label>
            RAM tối thiểu (GB)
            <Input
              type="number"
              min={0.125}
              step={1 / 1024}
              max={64}
              value={value.memoryMin}
              onChange={(event) =>
                field("memoryMin", Number(event.target.value))
              }
            />
          </label>
          <label>
            RAM tối đa (GB)
            <Input
              type="number"
              min={0.125}
              step={1 / 1024}
              max={64}
              value={value.memoryMax}
              onChange={(event) =>
                field("memoryMax", Number(event.target.value))
              }
            />
          </label>
        </div>
        <label>
          Java runtime riêng
          <Input
            value={value.javaPath}
            placeholder="Để trống để tự chọn Temurin"
            onChange={(event) => field("javaPath", event.target.value)}
          />
        </label>
        <label>
          JVM arguments — mỗi dòng một argument
          <Textarea
            rows={4}
            value={jvmArguments}
            placeholder="-XX:+UseG1GC"
            onChange={(event) => setJvmArguments(event.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Chiều rộng
            <Input
              type="number"
              min={320}
              max={16384}
              value={value.resolutionWidth}
              onChange={(event) =>
                field("resolutionWidth", Number(event.target.value))
              }
            />
          </label>
          <label>
            Chiều cao
            <Input
              type="number"
              min={240}
              max={16384}
              value={value.resolutionHeight}
              onChange={(event) =>
                field("resolutionHeight", Number(event.target.value))
              }
            />
          </label>
        </div>
        <label className="!flex-row items-center gap-2">
          <Switch
            checked={value.fullscreen}
            onCheckedChange={(checked) => field("fullscreen", checked)}
          />
          Toàn màn hình
        </label>
        <label>
          Tài khoản mặc định
          <InstanceSelect
            label="Tài khoản mặc định"
            value={value.accountId ?? ""}
            onChange={(value) => field("accountId", value || null)}
            items={[
              { value: "", label: "Dùng tài khoản đang chọn" },
              ...accounts.map((account) => ({
                value: account.id,
                label: account.username + " · " + account.provider,
              })),
            ]}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Vào server
            <Input
              value={value.joinServer}
              placeholder="play.example.net:25565"
              onChange={(event) =>
                field("joinServer", event.target.value.trim())
              }
            />
          </label>
          <label>
            Vào world
            <Input
              value={value.joinWorld}
              placeholder="Tên thư mục world"
              onChange={(event) =>
                field("joinWorld", event.target.value.trim())
              }
            />
          </label>
        </div>
        <label>
          Environment variables — mỗi dòng KEY=value
          <Textarea
            rows={4}
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
          />
        </label>
        <label>
          Lệnh trước khi chạy
          <Input
            value={value.preLaunchCommand}
            placeholder='"/đường/dẫn/chương-trình" --argument'
            onChange={(event) => field("preLaunchCommand", event.target.value)}
          />
        </label>
        <label>
          Lệnh sau khi thoát
          <Input
            value={value.postExitCommand}
            placeholder='"/đường/dẫn/chương-trình" --argument'
            onChange={(event) => field("postExitCommand", event.target.value)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Lệnh được chạy trực tiếp, không qua shell; toán tử như |, &amp;&amp;
          và &gt; không được diễn giải.
        </p>
        <label>
          GPU ưu tiên
          <InstanceSelect
            label="GPU ưu tiên"
            value={value.gpuPreference}
            onChange={(value) =>
              field("gpuPreference", value as InstanceSettings["gpuPreference"])
            }
            items={[
              { value: "default", label: "Mặc định hệ thống" },
              { value: "high-performance", label: "Hiệu năng cao" },
              { value: "integrated", label: "GPU tích hợp" },
            ]}
          />
        </label>
        {(["openGlPath", "openAlPath", "glfwPath"] as const).map((key) => (
          <label key={key}>
            {key === "openGlPath"
              ? "OpenGL"
              : key === "openAlPath"
                ? "OpenAL"
                : "GLFW"}{" "}
            library riêng
            <Input
              value={value[key]}
              placeholder="Để trống để dùng native của Minecraft"
              onChange={(event) => field(key, event.target.value)}
            />
          </label>
        ))}

        <Button
          type="button"
          className="h-9 self-end"
          onClick={() => void save()}
        >
          Lưu cấu hình instance
        </Button>
      </fieldset>
    </details>
  );
}
