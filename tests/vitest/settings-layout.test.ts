import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createLauncherRouter } from "@/lib/navigation";

it("returns from Settings to the previous route rather than always Home", () => {
  const router = createLauncherRouter(() => null);
  router.history.push("/gallery");
  router.history.push("/settings");
  router.history.back();
  expect(router.history.location.pathname).toBe("/gallery");
});

it("keeps settings in its own window layout and preserves the authentication overlay", () => {
  const source = readFileSync(
    new URL("../../app/index.tsx", import.meta.url),
    "utf8",
  );
  const start = source.indexOf('page === "settings" ||');
  expect(start).toBeGreaterThan(-1);
  const branch = source.slice(
    start,
    source.indexOf('<div className="flex h-dvh', start),
  );
  expect(branch).toContain("<SettingsLayout");
  expect(branch).toContain("<AuthScreen");
  expect(branch).toContain("setPage(lastMainPage.current)");
  const page = readFileSync(
    new URL("../../pages/settings/index.tsx", import.meta.url),
    "utf8",
  );
  expect(page).not.toContain('<nav aria-label="Launcher settings sections"');
});
