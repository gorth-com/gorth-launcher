import { mkdtemp, rm, stat, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/lib/game/java", () => ({
  checkJava: async (file: string) => {
    await stat(file);
    return file;
  },
}));
import { ensureMojangJava } from "@/lib/game/mojang-java";
afterEach(() => vi.unstubAllGlobals());
it.each([false, true])(
  "verifies runtime downloads and rejects traversal (malicious=%s)",
  async (malicious) => {
    const root = await mkdtemp(path.join(tmpdir(), "gorth-mojang-java-"));
    const binary = Buffer.from("fixture-runtime");
    const executable =
      process.platform === "darwin"
        ? "jre.bundle/Contents/Home/bin/java"
        : "bin/" + (process.platform === "win32" ? "java.exe" : "java");
    const hash = (value: Buffer) =>
      createHash("sha1").update(value).digest("hex");
    const manifest = Buffer.from(
      JSON.stringify({
        files: {
          ...(!malicious
            ? { "runtime-alias": { type: "link", target: executable } }
            : {}),
          [malicious ? "../escape" : executable]: {
            type: "file",
            executable: true,
            downloads: {
              raw: {
                url: "https://launcher.mojang.com/fixture/java",
                sha1: hash(binary),
                size: binary.length,
              },
            },
          },
        },
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        if (String(url).includes("all.json"))
          return Response.json(
            Object.fromEntries(
              [
                "mac-os-arm64",
                "mac-os",
                "windows-x64",
                "windows-arm64",
                "linux",
                "linux-arm64",
              ].map((platform) => [
                platform,
                {
                  "jre-legacy": [
                    {
                      manifest: {
                        url: "https://launcher.mojang.com/fixture/manifest",
                        sha1: hash(manifest),
                        size: manifest.length,
                      },
                    },
                  ],
                },
              ]),
            ),
          );
        return new Response(
          String(url).endsWith("/manifest") ? manifest : binary,
        );
      }),
    );
    try {
      const result = ensureMojangJava(
        root,
        8,
        "jre-legacy",
        AbortSignal.timeout(10000),
        () => {},
      );
      if (malicious) {
        await expect(result).rejects.toThrow("Đường dẫn");
        expect(
          (await readdir(path.join(root, "runtime"))).some((value) =>
            value.endsWith(".staging"),
          ),
        ).toBe(false);
      } else {
        const file = await result;
        expect(await readFile(file)).toEqual(binary);
        expect(file.startsWith(root + path.sep)).toBe(true);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
