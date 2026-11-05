import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { trackDevelopmentProcess } from "@/main/services/forge-lifecycle";

const [mode, executable, script, profile] = process.argv.slice(2);
if (!mode || !executable || !script || !profile)
  throw new Error(
    "A mode, Electron executable, fixture and temporary profile are required.",
  );
const child = spawn(executable, [script, `--smoke-mode=${mode}`, profile], {
  stdio: "inherit",
});
child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code) => process.exit(code ?? 1));
// Reproduce Vite's immediate exit listener, registered before our Forge hook.
process.on("SIGINT", () => process.exit(0));
trackDevelopmentProcess(child);
const timer = setInterval(() => {
  if (!existsSync(path.join(profile, `ready-${mode}`))) return;
  clearInterval(timer);
  process.kill(process.pid, mode === "parent-kill" ? "SIGKILL" : "SIGINT");
}, 100);
