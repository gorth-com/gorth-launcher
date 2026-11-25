import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
import { createUpdateController } from "@/main/services/update-controller";
import {
  isNewerRelease,
  parseRelease,
  releaseVersion,
} from "@gorth-com/structure/modules/desktop";
const release = (version = "1.1.0") => ({
  tag_name: "v" + version,
  draft: false,
  prerelease: false,
  assets: [{ name: "app-1.1.0-darwin-arm64.zip" }],
});
function fixture(disabledReason?: string) {
  const events = new EventEmitter();
  const driver = {
    on: events.on.bind(events),
    removeListener: events.removeListener.bind(events),
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
  };
  const fetcher = vi.fn(async () => new Response(JSON.stringify(release())));
  const confirm = vi.fn(async () => true);
  const controller = createUpdateController({
    version: "1.0.0",
    owner: "gorth-io",
    repository: "fixture",
    platform: "darwin",
    arch: "arm64",
    disabledReason,
    driver,
    fetch: fetcher,
    confirmInstall: confirm,
  });
  return { controller, events, driver, fetcher, confirm };
}
it("compares stable versions numerically and never offers prereleases or downgrades", () => {
  expect(releaseVersion("v1.20.3")).toBe("1.20.3");
  expect(isNewerRelease("1.10.0", "1.9.9")).toBe(true);
  expect(isNewerRelease("1.0.0", "1.0.0")).toBe(false);
  expect(isNewerRelease("0.9.0", "1.0.0")).toBe(false);
  for (const value of [
    "1.1.0-beta.1",
    "01.2.3",
    "https://evil.test",
    "999.bad",
    "1.2",
  ])
    expect(releaseVersion(value)).toBeUndefined();
});
it("requires stable release artifacts matching platform and architecture", () => {
  expect(parseRelease(release(), "darwin", "arm64")).toBe("1.1.0");
  expect(() => parseRelease(release(), "darwin", "x64")).toThrow();
  expect(() =>
    parseRelease({ ...release(), prerelease: true }, "darwin", "arm64"),
  ).toThrow();
  expect(() =>
    parseRelease({ ...release(), draft: true }, "darwin", "arm64"),
  ).toThrow();
  expect(() => parseRelease(release(), "win32", "x64")).toThrow();
  const windows = {
    ...release(),
    assets: [
      { name: "app-win32-x64-setup.exe" },
      { name: "RELEASES" },
      { name: "app-1.1.0-full.nupkg" },
    ],
  };
  expect(parseRelease(windows, "win32", "x64")).toBe("1.1.0");
});
it("checks metadata without downloading, coalesces checks and downloads only after explicit consent", async () => {
  const f = fixture();
  await Promise.all([f.controller.check(), f.controller.check()]);
  expect(f.fetcher).toHaveBeenCalledOnce();
  expect(f.driver.checkForUpdates).not.toHaveBeenCalled();
  expect(f.controller.snapshot().status).toBe("available");
  f.controller.download();
  f.controller.download();
  expect(f.driver.checkForUpdates).toHaveBeenCalledOnce();
  expect(f.driver.setFeedURL).toHaveBeenCalledWith({
    url: "https://update.electronjs.org/gorth-io/fixture/darwin-arm64/1.0.0",
  });
  await f.controller.check();
  expect(f.fetcher).toHaveBeenCalledOnce();
  f.events.emit("update-downloaded", {}, "", "1.1.0");
  expect(f.controller.snapshot().status).toBe("downloaded");
  await f.controller.install();
  expect(f.confirm).toHaveBeenCalledOnce();
  expect(f.driver.quitAndInstall).toHaveBeenCalledOnce();
  f.controller.dispose();
});
it("does not install before downloading or after a cancelled or blocked restart", async () => {
  const f = fixture();
  await f.controller.install();
  expect(f.confirm).not.toHaveBeenCalled();
  await f.controller.check();
  f.controller.download();
  f.events.emit("update-downloaded", {}, "", "1.1.0");
  f.confirm.mockResolvedValueOnce(false);
  await f.controller.install();
  expect(f.controller.snapshot().status).toBe("downloaded");
  f.confirm.mockRejectedValueOnce(new Error("game busy"));
  await f.controller.install();
  expect(f.driver.quitAndInstall).not.toHaveBeenCalled();
  expect(f.controller.snapshot().status).toBe("downloaded");
  f.controller.dispose();
});
it("is disabled in dev/unsupported installations without network or native updater calls", async () => {
  const f = fixture("Development");
  await f.controller.check();
  f.controller.download();
  await f.controller.install();
  expect(f.controller.snapshot().status).toBe("disabled");
  expect(f.fetcher).not.toHaveBeenCalled();
  expect(f.driver.setFeedURL).not.toHaveBeenCalled();
  expect(f.driver.quitAndInstall).not.toHaveBeenCalled();
});
it("reports errors, handles native no-update and removes listeners on shutdown", async () => {
  const f = fixture();
  f.fetcher.mockRejectedValueOnce(new Error("network"));
  await f.controller.check();
  expect(f.controller.snapshot().status).toBe("error");
  await f.controller.check();
  f.controller.download();
  f.events.emit("error", new Error("bad signature"));
  expect(f.controller.snapshot().status).toBe("error");
  expect(f.controller.snapshot().message).not.toContain("bad signature");
  await f.controller.check();
  f.controller.download();
  f.events.emit("update-not-available");
  expect(f.controller.snapshot().status).toBe("current");
  f.controller.dispose();
  expect(f.events.listenerCount("update-downloaded")).toBe(0);
  await f.controller.check();
  expect(f.fetcher).toHaveBeenCalledTimes(3);
});
