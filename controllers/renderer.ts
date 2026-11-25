import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { serveStatic, type H3Event } from "nitro/h3";
import { desktopContext } from "@/lib/server/context";

export async function actGetRendererAsset(event: H3Event) {
  const { development, rendererDirectory } = desktopContext(event);
  if (development || !rendererDirectory)
    return new Response("Not Found", { status: 404 });
  const root = path.resolve(rendererDirectory);
  const filename = (id: string) => {
    const resolved = path.resolve(root, "." + id);
    return resolved.startsWith(root + path.sep) ? resolved : undefined;
  };
  return serveStatic(event, {
    getMeta: async (id) => {
      const file = filename(id);
      if (!file) return;
      const info = await stat(file).catch(() => null);
      return info?.isFile()
        ? { size: info.size, mtime: info.mtime }
        : undefined;
    },
    getContents: async (id) => {
      const file = filename(id);
      if (!file) return;
      return readFile(file);
    },
  });
}
