import type { ChildProcess } from "node:child_process";

export function trackDevelopmentProcess(appProcess: ChildProcess) {
  const terminate = () => {
    if (
      appProcess.exitCode === null &&
      appProcess.signalCode === null &&
      !appProcess.killed
    )
      appProcess.kill("SIGTERM");
  };
  const dispose = () => {
    process.off("SIGINT", terminate);
    process.off("SIGTERM", terminate);
    process.off("exit", terminate);
  };
  // Vite's SIGINT handler calls process.exit before Forge forwards the signal.
  process.prependListener("SIGINT", terminate);
  process.prependListener("SIGTERM", terminate);
  process.once("exit", terminate);
  appProcess.once("exit", dispose);
}
