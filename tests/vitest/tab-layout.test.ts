import { defaultSettings } from "@/utils/constant";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { settingsSchema } from "@/lib/library/settings-schema";
import { readSettings } from "@/utils/launcher";

describe("launcher layout", () => {
  it("preserves collapsed sidebar modes and defaults older profiles", () => {
    expect(settingsSchema.parse({ memory: 4, javaPath: "" })).toMatchObject({
      sidebarCollapsible: true,
      sidebarCollapseMode: "none",
    });
    for (const sidebarCollapseMode of ["icon", "none"]) {
      expect(
        settingsSchema.parse({
          ...defaultSettings,
          sidebarCollapsible: true,
          sidebarCollapseMode,
        }),
      ).toMatchObject({ sidebarCollapsible: true, sidebarCollapseMode });
    }
    expect(
      settingsSchema.safeParse({
        ...defaultSettings,
        sidebarCollapseMode: "invalid",
      }).success,
    ).toBe(false);
  });
  it("defaults existing profiles to separate", () => {
    expect(defaultSettings.tabLayout).toBe("separate");
    expect(settingsSchema.parse({ memory: 4, javaPath: "" }).tabLayout).toBe(
      "separate",
    );
    expect(readSettings().tabLayout).toBe("separate");
  });

  it.each(["separate", "compact"] as const)(
    "preserves %s in persisted settings",
    (tabLayout) => {
      expect(
        settingsSchema.parse({ ...defaultSettings, tabLayout }).tabLayout,
      ).toBe(tabLayout);
    },
  );

  it("rejects unknown layout values", () => {
    expect(
      settingsSchema.safeParse({ ...defaultSettings, tabLayout: "unknown" })
        .success,
    ).toBe(false);
  });

  it("reuses navigation controls inside the title bar in compact mode", async () => {
    const title = await readFile(
      new URL("../../layouts/title-bar.tsx", import.meta.url),
      "utf8",
    );
    const app = await readFile(
      new URL("../../app/index.tsx", import.meta.url),
      "utf8",
    );
    const dashboard = await readFile(
      new URL("../../layouts/dashboard.tsx", import.meta.url),
      "utf8",
    );
    expect(title).toContain("<NavigationControls {...navigation}");
    expect(app).toContain("navigation={compact ? navigationProps : undefined}");
    expect(app).toContain("!compact && <NavigationBar {...navigationProps}");
    expect(dashboard).toContain("top-14 h-[calc(100svh-3.5rem)]");
  });
});
