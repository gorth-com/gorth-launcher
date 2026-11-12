import type { InstanceSettings } from "@/utils/interface";

// An explicit instance override wins. Otherwise select the required major,
// falling back to the default path and finally the existing auto-detection.
export function javaPathForMajor(settings: Pick<InstanceSettings, "javaPath" | "javaPaths">, major: number) {
  const version = major === 16 ? 17 : major;
  const specific = version === 17 || version === 21 || version === 25
    ? settings.javaPaths?.[String(version) as "17" | "21" | "25"] : "";
  return settings.javaPath.trim() || specific?.trim() || settings.javaPaths?.default?.trim() || "";
}
