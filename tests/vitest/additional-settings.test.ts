import { expect, it } from "vitest";
import { launcherSettingsSections } from "@/utils/constant";
import { settingsSchema } from "@/lib/library/settings-schema";
import { createLauncherRouter } from "@/lib/navigation";
it("registers missing settings without duplicating existing sections", () => {
  const ids = launcherSettingsSections.map((entry) => entry.id);
  expect(new Set(ids).size).toBe(ids.length);
  const routes = createLauncherRouter(() => null).routesByPath;
  for (const key of [
    "general",
    "language",
    "services",
    "tools",
    "proxy",
    "runtime",
    "instance",
    "appearance",
  ]) {
    expect(ids).toContain(key);
    expect(routes).toHaveProperty("/settings/" + key);
  }
});
it("keeps new preferences in the persisted validated payload", () => {
  const settings = settingsSchema.parse({
    memory: 4,
    javaPath: "",
    instanceSort: "last-played",
    consoleLogLimit: 5000,
    locale: "vi",
    toolPaths: { textEditor: "/tmp/editor" },
  });
  expect(settings).toMatchObject({
    instanceSort: "last-played",
    consoleLogLimit: 5000,
    locale: "vi",
    toolPaths: { textEditor: "/tmp/editor" },
  });
  expect(
    settingsSchema.parse({ memory: 4, javaPath: "" }).consoleLogLimit,
  ).toBe(1000);
  for (const consoleLogLimit of [0, -1, 100001, 0.5])
    expect(
      settingsSchema.safeParse({ ...settings, consoleLogLimit }).success,
    ).toBe(false);
});
