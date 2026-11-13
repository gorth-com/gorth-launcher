import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
} from "@gorth-io/primitive/cores/tanstack/query";
import { InstanceSettingsForm } from "@/components/form/instance-settings-form";
import { ToasterProvider } from "@/providers/toaster";
import { defaultInstanceSettings } from "@/lib/library/instance-settings";
import { instanceSettingsSchema } from "@/lib/library/instance-settings";
import { defaultSettings } from "@/utils/constant";
import type { InstanceSettings } from "@/utils/interface";
import "@/styles/globals.css";

const settings = { ...defaultSettings, javaPath: "/global/java" };
const saved: InstanceSettings[] = [];
const errors: string[] = [];
let scans = 0;
Object.assign(window, {
  electronAPI: {
    settings: {
      javaInstallations: async () => {
        scans++;
        return [17, 21].map((major) => ({
          path: `/java-${major}/bin/java`,
          version: `${major}.0.1`,
          major,
          vendor: "Fixture",
          architecture: "x86_64",
        }));
      },
      chooseJava: async () => "/browsed/java",
      testJava: async () => ({
        path: "/browsed/java",
        version: "21.0.1",
        major: 21,
        vendor: "Fixture",
        architecture: "x86_64",
      }),
    },
    instanceData: {
      snapshot: async () => ({
        ok: true,
        data: { worlds: [{ name: "Test World" }] },
      }),
    },
  },
});
function Fixture() {
  const [id, setId] = useState("alpha");
  Object.assign(window, {
    settingsTest: {
      saved,
      errors,
      scans,
      id,
      switchInstance: () => setId("beta"),
    },
  });
  return (
    <InstanceSettingsForm
      key={id}
      initialSettings={defaultInstanceSettings(settings)}
      globalSettings={settings}
      instanceId={id}
      accounts={[]}
      busy={false}
      onSave={async (value) => {
        saved.push(instanceSettingsSchema.parse(value));
        return true;
      }}
    />
  );
}
createRoot(document.getElementById("root")!, {
  onUncaughtError: (error) => errors.push(String(error)),
}).render(
  <QueryClientProvider client={new QueryClient()}>
    <ToasterProvider>
      <Fixture />
    </ToasterProvider>
  </QueryClientProvider>,
);
