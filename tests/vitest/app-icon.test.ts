import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("uses the public icon for the window and the macOS Dock", async () => {
  const root = new URL("../../", import.meta.url);
  const windowSource = await readFile(
    new URL("main/windows/capital.ts", root),
    "utf8",
  );
  const mainSource = await readFile(new URL("app/main.ts", root), "utf8");
  expect(windowSource).toContain("icon: getRuntimeAppIconPath()");
  expect(windowSource).toContain(
    'path.join(app.getAppPath(), "public", filename)',
  );
  expect(mainSource).toContain(
    "await app.dock?.setIcon(getRuntimeAppIconPath())",
  );
  const png = await readFile(new URL("public/favicon.png", root));
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
});
