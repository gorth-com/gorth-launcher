import { app } from "electron";
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { downloadWebsiteFile } from "@/main/services/content-download";

const root = process.argv[2];
app.setPath("userData", root);
app.setPath("sessionData", root);
app.on("window-all-closed", () => {});
app.on("web-contents-created", (_event, contents) => {
  void contents.session.protocol.handle("https", (request) => {
    if (new URL(request.url).hostname === "edge.forgecdn.net")
      return new Response("mod", {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="mod.jar"',
          "Content-Length": "3",
        },
      });
    return new Response(
      '<script>setTimeout(() => location.href = "https://edge.forgecdn.net/files/1/2/mod.jar", 100)</script>',
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  });
});
void app.whenReady().then(async () => {
  const target = path.join(root, "instance", "mods", "mod.jar");
  try {
    await downloadWebsiteFile(
      {
        projectId: "1",
        versionId: "2",
        filename: "mod.jar",
        required: [],
        websiteDownload:
          "https://www.curseforge.com/minecraft/mc-mods/fixture/download/2",
        artifact: {
          url: "https://edge.forgecdn.net/files/1/2/mod.jar",
          size: 3,
          sha1: createHash("sha1").update("mod").digest("hex"),
        },
      },
      target,
      AbortSignal.timeout(12_000),
    );
    if (
      (await readFile(target, "utf8")) !== "mod" ||
      (await readdir(path.join(root, "temps"))).length
    )
      throw new Error("Native download verification failed");
    console.log("NATIVE_CONTENT_DOWNLOAD_OK");
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
