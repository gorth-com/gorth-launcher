import type { Dispatch, SetStateAction } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@gorth-io/primitive/default/card";
import { RadioGroup, RadioGroupItem } from "@gorth-io/primitive/custom/radio";
import type { Settings } from "@/utils/interface";

export function StartupSettings({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
}) {
  return (
    <Card className="flex flex-col gap-4 p-4">
      <CardHeader className="p-0">
        <CardTitle>On startup</CardTitle>
      </CardHeader>
      <CardContent className="p-0 gap-4">
        <RadioGroup
          aria-label="On startup"
          value={
            settings.startup === "page"
              ? "home"
              : (settings.startup ?? "restore")
          }
          onValueChange={(value) => {
            if (value === "home" || value === "restore")
              setSettings((previous) => ({ ...previous, startup: value }));
          }}
        >
          <label className="flex items-center gap-2">
            <RadioGroupItem value="home" />
            Open the Home page
          </label>
          <label className="flex items-center gap-2">
            <RadioGroupItem value="restore" />
            Continue where you left off
          </label>
          <label className="flex items-center gap-2 opacity-50">
            <RadioGroupItem value="page" disabled />
            Open a specific page
          </label>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
