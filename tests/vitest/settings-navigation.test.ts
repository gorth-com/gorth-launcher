import { expect, it } from "vitest";
import {
  launcherPages,
  launcherSettingsSections,
  navigation,
} from "@/utils/constant";
import { createLauncherRouter } from "@/lib/navigation";

it("places Content and Shortcuts after Appearance and registers every settings route", () => {
  expect(launcherSettingsSections.slice(0, 3).map((item) => item.id)).toEqual([
    "appearance",
    "content",
    "shortcuts",
  ]);
  const router = createLauncherRouter(() => null);
  for (const section of launcherSettingsSections) {
    const page = `settings/${section.id}` as const;
    expect(launcherPages).toContain(page);
    expect(router.routesByPath).toHaveProperty(`/${page}`);
  }
  expect(navigation.map((item) => item.id)).not.toContain("shortcuts");
  expect(navigation.map((item) => item.id)).not.toContain("accounts");
  expect(navigation.map((item) => item.id)).not.toContain("settings/instance");
});
