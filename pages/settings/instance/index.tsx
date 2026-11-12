import { Box } from "@gorth-io/primitive/cores/lucide";
import { InstanceSelect } from "@/components/element/instance-select";
import { useState } from "react";
import { PageHeading } from "@/components/heading";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@gorth-io/primitive/default/card";
import { Button } from "@gorth-io/primitive/custom/button";
import { PageShell } from "@/layouts/page-shell";
import { InstanceSettingsForm } from "@/components/form/instance-settings-form";
import type {
  AccountView,
  Settings,
  Instance,
  InstanceSettings,
} from "@/utils/interface";

export function InstancePreferencesPage({
  instances,
  settings,
  globalSettings,
  accounts,
  busy,
  onSave,
  onEdit,
}: {
  instances: Instance[];
  settings: Record<string, InstanceSettings>;
  globalSettings?: Settings;
  accounts: AccountView[];
  busy: boolean;
  onSave: (id: string, value: InstanceSettings) => Promise<boolean>;
  onEdit: (item: Instance) => void;
}) {
  const [id, setId] = useState("");
  const selected = instances.find((item) => item.id === id) ?? instances[0];
  return (
    <div className="flex flex-col gap-6">
      <PageHeading icon={Box} title="Minecraft" />
      <PageShell
        aside={
          <Card>
            <CardHeader>
              <CardTitle>Instance Settings</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                RAM, Java, JVM, resolution, account, GPU and launch commands.
              </p>
              <InstanceSelect
                label="Chọn instance cấu hình"
                value={selected?.id ?? ""}
                disabled={!instances.length}
                items={
                  instances.length
                    ? instances.map((item) => ({
                        value: item.id,
                        label: item.name,
                      }))
                    : [{ value: "", label: "Chưa có instance" }]
                }
                onChange={setId}
              />
              {selected && (
                <Button
                  className="h-9 w-full"
                  variant="outline"
                  onClick={() => onEdit(selected)}
                >
                  Đổi tên, version và loader
                </Button>
              )}
            </CardContent>
          </Card>
        }
      >
        {selected && settings[selected.id] ? (
          <Card>
            <CardHeader>
              <CardTitle>{selected.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <InstanceSettingsForm
                key={selected.id}
                instanceId={selected.id}
                globalSettings={globalSettings}
                initialSettings={settings[selected.id]}
                accounts={accounts}
                busy={busy}
                onSave={(value) => onSave(selected.id, value)}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Tạo instance trước khi chỉnh cấu hình riêng.
            </CardContent>
          </Card>
        )}
      </PageShell>
    </div>
  );
}
