import { CardTitle, CardDescription } from "@gorth-com/primitive/default/card";
import { Switch } from "@gorth-com/primitive/default/switch";
import {
  RadioGroup,
  RadioGroupItem,
} from "@gorth-com/primitive/default/radio-group";

interface SidebarSettingsProps {
  enabled: boolean;
  mode: "icon" | "none";
  onEnabledChange: (enabled: boolean) => void;
  onModeChange: (mode: "icon" | "none") => void;
}
export function SidebarSettings({
  enabled,
  mode,
  onEnabledChange,
  onModeChange,
}: SidebarSettingsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle id="sidebar-collapsible-label">
            Collapsible sidebar
          </CardTitle>
          <CardDescription>{enabled ? "Collapsed" : "Normal"}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <CardTitle id="sidebar-collapse-switch-label">Collapse</CardTitle>
          <Switch
            aria-labelledby="sidebar-collapse-switch-label"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>
      </div>
      <RadioGroup
        aria-label="Collapsed sidebar"
        value={mode}
        className="flex flex-col gap-4"
        onValueChange={(value) => {
          if (value === "icon" || value === "none") onModeChange(value);
        }}
      >
        <label className="flex items-center gap-3 text-sm">
          <RadioGroupItem value="icon" />
          Show an icon rail
        </label>
        <label className="flex items-center gap-3 text-sm">
          <RadioGroupItem value="none" />
          Hide completely
        </label>
      </RadioGroup>
    </div>
  );
}
