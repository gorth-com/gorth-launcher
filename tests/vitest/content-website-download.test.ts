import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  root: "",
  mode: "success",
  saved: "",
  windowOptions: {} as Record<string, unknown>,
  shows: 0,
}));

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  const isolated = Object.assign(new EventEmitter(), {
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
  });
  return {
    app: Object.assign(new EventEmitter(), { getPath: () => fixture.root }),
    session: { fromPartition: () => isolated },
    BrowserWindow: function (options: Record<string, unknown>) {
      fixture.windowOptions = options;
      const contents = Object.assign(new EventEmitter(), {
        setWindowOpenHandler: vi.fn(),
      });
      let destroyed = false;
      return Object.assign(new EventEmitter(), {
        webContents: contents,
        show: () => {
          fixture.shows++;
        },
        isDestroyed: () => destroyed,
        destroy: () => {
          destroyed = true;
        },
        loadURL: async () => {
          if (fixture.mode === "wait") return;
          const item = Object.assign(new EventEmitter(), {
            getURL: () => "https://edge.forgecdn.net/files/1/2/mod.jar",
            getURLChain: () => ["https://edge.forgecdn.net/files/1/2/mod.jar"],
            setSavePath: (value: string) => {
              fixture.saved = value;
            },
            getState: () => "completed",
          });
          const event = { preventDefault: vi.fn() };
          isolated.emit("will-download", event, item, contents);
          if (event.preventDefault.mock.calls.length) return;
          await writeFile(
            fixture.saved,
            fixture.mode === "corrupt" ? "bad" : "mod",
          );
          item.emit("done", {}, "completed");
        },
      });
    },
  };
});

import { app, session } from "electron";
import {
  allowedWebsiteArtifact,
  downloadWebsiteFile,
} from "@/main/services/content-download";
import { resolveContentFile } from "@/lib/content/providers";
import { fetcher } from "@/utils/fetcher";
vi.mock("@/utils/fetcher", () => ({ fetcher: vi.fn() }));
vi.mock("@/utils/environment", () => ({ curseforgeApiKey: "test-key" }));

const file = {
  projectId: "1",
  versionId: "2",
  filename: "mod.jar",
  websiteDownload:
    "https://www.curseforge.com/minecraft/mc-mods/fixture/download/2",
  artifact: {
    url: "https://www.curseforge.com/",
    sha1: createHash("sha1").update("mod").digest("hex"),
    size: 3,
  },
  required: [],
};

beforeEach(async () => {
  fixture.root = await mkdtemp(path.join(tmpdir(), "gorth-website-download-"));
  fixture.mode = "success";
  fixture.shows = 0;
  vi.mocked(fetcher).mockReset();
});
afterEach(async () => {
  await rm(fixture.root, { recursive: true, force: true });
});

it("downloads hidden into temps, verifies bytes and removes temporary files/listeners", async () => {
  const target = path.join(fixture.root, "instance", "mods", "mod.jar");
  await downloadWebsiteFile(file, target, new AbortController().signal);
  expect(await readFile(target, "utf8")).toBe("mod");
  expect(
    fixture.saved.startsWith(path.join(fixture.root, "temps") + path.sep),
  ).toBe(true);
  expect(await readdir(path.join(fixture.root, "temps"))).toEqual([]);
  expect(fixture.windowOptions).toMatchObject({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  expect(fixture.shows).toBe(0);
  expect(session.fromPartition("test").listenerCount("will-download")).toBe(0);
  expect(app.listenerCount("before-quit")).toBe(0);
});

it("rejects a corrupted download before copying into the instance", async () => {
  fixture.mode = "corrupt";
  const target = path.join(fixture.root, "mod.jar");
  await expect(
    downloadWebsiteFile(file, target, new AbortController().signal),
  ).rejects.toThrow("checksum");
  await expect(readFile(target)).rejects.toThrow();
  expect(await readdir(path.join(fixture.root, "temps"))).toEqual([]);
});

it("reveals a stalled page for user interaction and aborts with cleanup", async () => {
  fixture.mode = "wait";
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const controller = new AbortController();
    const pending = downloadWebsiteFile(
      file,
      path.join(fixture.root, "mod.jar"),
      controller.signal,
    );
    const rejected = expect(pending).rejects.toThrow("hủy");
    // Let filesystem preparation finish before advancing the UI timer.
    while (session.fromPartition("test").listenerCount("will-download") === 0)
      await new Promise<void>((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fixture.shows).toBe(1);
    controller.abort();
    await rejected;
    expect(session.fromPartition("test").listenerCount("will-download")).toBe(
      0,
    );
  } finally {
    vi.useRealTimers();
  }
});

it.each([
  "http://edge.forgecdn.net/a",
  "https://edge.forgecdn.net.evil.test/a",
  "https://user@edge.forgecdn.net/a",
  "file:///tmp/mod.jar",
])("rejects unsafe download URL %s", (url) => {
  expect(allowedWebsiteArtifact(url)).toBe(false);
});

it("allows restricted manifest files through the official page only when explicitly enabled", async () => {
  const query = {
    provider: "curseforge" as const,
    kind: "mod" as const,
    query: "",
    offset: 0,
    version: "1.20.1",
    loader: "forge",
  };
  const response = {
    data: {
      data: {
        id: 2,
        modId: 1,
        displayName: "Mod",
        fileName: "mod.jar",
        isAvailable: true,
        releaseType: 1,
        gameVersions: ["1.20.1", "Forge"],
        downloadUrl: null,
        fileLength: 3,
        hashes: [{ algo: 1, value: file.artifact.sha1 }],
        dependencies: [],
      },
    },
  };
  const project = {
    data: {
      data: { classId: 6, slug: "fixture", allowModDistribution: false },
    },
  };
  vi.mocked(fetcher)
    .mockResolvedValueOnce(response as never)
    .mockResolvedValueOnce(project as never);
  await expect(
    resolveContentFile(query, "1", "2", new AbortController().signal, true),
  ).rejects.toThrow("bên thứ ba");
  vi.mocked(fetcher)
    .mockResolvedValueOnce(response as never)
    .mockResolvedValueOnce(project as never);
  const result = await resolveContentFile(
    query,
    "1",
    "2",
    new AbortController().signal,
    true,
    true,
  );
  expect(result.websiteDownload).toBe(file.websiteDownload);
  expect(result.artifact.sha1).toBe(file.artifact.sha1);
});
