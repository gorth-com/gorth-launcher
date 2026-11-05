import { expect, it } from "vitest";
import { shortcutDefinitions } from "@/utils/constant";
import { validateShortcutChange } from "@/lib/shortcuts";

import {
  navigation,
  launcherPages,
  defaultSettings,
  loaderCatalog,
  contentLabels,
  curseforgeClasses,
  curseforgePaths,
  artifactHosts,
  updateRepository,
} from "@/utils/constant";
import { supportedLoader } from "@/lib/game/catalog";
import { projectWebsite } from "@/lib/content/website";
it("keeps the centralized launcher navigation, presets and provider data consistent", () => {
  for (const item of navigation) {
    expect(launcherPages).toContain(item.id);
    expect(item.icon).toBeDefined();
  }
  for (const item of loaderCatalog)
    expect(
      supportedLoader({
        loader: item.loader,
        version: item.minecraft,
        loaderVersion: item.version,
      }),
    ).toBe(true);
  for (const kind of Object.keys(
    contentLabels,
  ) as (keyof typeof contentLabels)[]) {
    expect(curseforgeClasses[kind]).toBeGreaterThan(0);
    expect(projectWebsite("curseforge", kind, "fixture")).toContain(
      "/" + curseforgePaths[kind] + "/fixture",
    );
  }
  expect(defaultSettings.tabLayout).toBe("separate");
  expect(artifactHosts.has("libraries.minecraft.net")).toBe(true);
  expect(artifactHosts.has("evil.test")).toBe(false);
  expect(updateRepository.repository).toBe("gorth-launcher");
});

it("preserves the shortcut catalog and reserved accelerator policy", () => {
  expect(new Set(shortcutDefinitions.map((item) => item.id)).size).toBe(
    shortcutDefinitions.length,
  );
  const shortcuts = shortcutDefinitions.map((item) => ({
    ...item,
    accelerator: item.defaultAccelerator,
  }));
  expect(() =>
    validateShortcutChange(shortcuts, shortcuts[0].id, "CmdOrCtrl+C", false),
  ).toThrow();
});
