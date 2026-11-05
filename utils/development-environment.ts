// Forge tooling only. Never import this module from renderer/preload code.
import { loadEnvFile } from "node:process";
import path from "node:path";

export function loadDevelopmentEnvironment(projectDirectory: string) {
  try {
    // Node preserves shell/CI values and treats $ characters literally (API keys).
    loadEnvFile(path.join(projectDirectory, ".env.local"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    // Do not include parser details or file contents in logs.
    throw new Error("Không thể nạp .env.local cho desktop main process.");
  }
}
