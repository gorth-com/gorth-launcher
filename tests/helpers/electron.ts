import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Resolve only; never import electron's Node shim, which may install a binary.
export function getElectronExecutable() {
  const require = createRequire(import.meta.url);
  const directory = path.dirname(require.resolve("electron/package.json"));
  const override = process.env.ELECTRON_OVERRIDE_DIST_PATH;
  const binary =
    process.platform === "darwin"
      ? "Electron.app/Contents/MacOS/Electron"
      : process.platform === "win32"
        ? "electron.exe"
        : "electron";
  const executable = override
    ? path.join(override, binary)
    : path.join(directory, "dist", binary);
  if (!existsSync(executable))
    throw new Error(
      "Electron binary is missing. Install it explicitly or set ELECTRON_OVERRIDE_DIST_PATH to a matching extracted Electron distribution.",
    );
  if (!override) {
    const file = path.join(directory, "path.txt");
    if (!existsSync(file) || !readFileSync(file, "utf8").trim())
      throw new Error("Electron installation is incomplete.");
  }
  return executable;
}
