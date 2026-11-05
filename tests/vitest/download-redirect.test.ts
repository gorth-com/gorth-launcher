import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("@/lib/http/transport", () => ({ desktopFetch: transport }));
import { download, response } from "@/lib/game/files";

beforeEach(() => transport.mockReset());

it("downloads a redirected modpack archive and verifies its checksum", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gorth-modpack-redirect-"));
  try {
    const bytes = Buffer.from("fixture modpack archive");
    transport.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://mediafilez.forgecdn.net/files/pack.zip" },
      }),
    );
    transport.mockResolvedValueOnce(new Response(bytes));
    const file = path.join(root, "pack.zip");
    await download(
      {
        url: "https://edge.forgecdn.net/files/pack.zip",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        size: bytes.length,
      },
      file,
      AbortSignal.timeout(5000),
    );
    expect(await readFile(file)).toEqual(bytes);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(
      transport.mock.calls.every(
        ([, options]) => options?.redirect === "manual",
      ),
    ).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("rejects an untrusted redirect before sending a request to its destination", async () => {
  transport.mockResolvedValueOnce(
    new Response(null, {
      status: 302,
      headers: { location: "https://untrusted.invalid/pack.zip" },
    }),
  );
  await expect(
    response("https://edge.forgecdn.net/pack.zip", AbortSignal.timeout(5000)),
  ).rejects.toThrow("Nguồn tải không được phép");
  expect(transport).toHaveBeenCalledTimes(1);
});

it("bounds redirect loops", async () => {
  transport.mockImplementation(
    async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://edge.forgecdn.net/loop" },
      }),
  );
  await expect(
    response("https://edge.forgecdn.net/loop", AbortSignal.timeout(5000)),
  ).rejects.toThrow("Quá nhiều chuyển hướng");
  expect(transport).toHaveBeenCalledTimes(6);
});
