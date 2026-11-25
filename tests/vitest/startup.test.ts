import { expect, it } from "vitest";
import { validStartupLocation, startupLocation } from "@/lib/startup";
import { settingsSchema } from "@/lib/library/settings-schema";
import type { LibrarySnapshot } from "@/utils/interface";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { rawCreateLibraryStore } from "@/models/instance";
import { createLauncherRouter } from "@/lib/navigation";

const snapshot: LibrarySnapshot = {
  instances: [],
  instanceSettings: {},
  trash: [],
  settings: { memory: 4, javaPath: "" },
  lastLocation: "/settings/runtime",
};
it("persists navigation independently of settings and initializes the next router from SQLite", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "gorth-startup-"));
  let store: Awaited<ReturnType<typeof rawCreateLibraryStore>> | undefined;
  try {
    store = await rawCreateLibraryStore(directory, () => false);
    await store.command({
      action: "navigation.save",
      location: "/settings/runtime",
    });
    store.close();
    store = await rawCreateLibraryStore(directory, () => false);
    const restored = startupLocation(store.snapshot());
    const router = createLauncherRouter(() => null, restored);
    expect(router.history.location.pathname).toBe("/settings/runtime");
    await expect(
      store.command({
        action: "navigation.save",
        location: "https://example.com",
      }),
    ).rejects.toThrow();
    expect(store.snapshot().settings.javaPath).toBe("");
  } finally {
    store?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
it("restores the last settings page by default and respects explicit startup modes", () => {
  expect(startupLocation(snapshot)).toBe("/settings/runtime");
  expect(
    startupLocation({
      ...snapshot,
      settings: { ...snapshot.settings, startup: "home" },
    }),
  ).toBe("/home");
  expect(
    startupLocation({
      ...snapshot,
      settings: {
        ...snapshot.settings,
        startup: "page",
        startupPage: "/modpacks",
      },
    }),
  ).toBe("/home");
  expect(settingsSchema.parse(snapshot.settings).startup).toBe("restore");
});
it("preserves instance sections, handles removed instances and rejects external or secret-bearing URLs", () => {
  const location = "/instances/edit/fixture?section=settings";
  expect(validStartupLocation(location)).toBe(true);
  expect(startupLocation({ ...snapshot, lastLocation: location })).toBe(
    "/instances",
  );
  expect(
    startupLocation({
      ...snapshot,
      lastLocation: location,
      instances: [
        {
          id: "fixture",
          name: "Fixture",
          version: "1.20.1",
          loader: "Vanilla",
          createdAt: 0,
        },
      ],
    }),
  ).toBe(location);
  for (const value of [
    "https://example.com",
    "//example.com",
    "/auth/callback?token=secret",
    "/home?token=secret",
    "/unknown",
    "/home#secret",
  ])
    expect(validStartupLocation(value)).toBe(false);
});
