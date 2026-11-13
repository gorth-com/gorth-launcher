import { app } from "electron";
import { get as getHttp, type ClientRequest } from "node:http";
import { get as getHttps } from "node:https";

export function installDevelopmentLifecycle(rendererUrl: string) {
  if (app.isPackaged || !rendererUrl) return () => {};

  const url = new URL(rendererUrl);
  const request = url.protocol === "https:" ? getHttps : getHttp;
  const parentPid = process.ppid;
  let disposed = false;
  let failures = 0;
  let lastReachable = Date.now();
  let pending: ClientRequest | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    pending?.destroy();
    process.off("SIGINT", quit);
    process.off("SIGTERM", quit);
    app.off("will-quit", dispose);
  };
  const quit = (reason = "Dev server unavailable") => {
    if (disposed) return;
    console.info(`[dev lifecycle] Stopping Electron: ${reason}`);
    dispose();
    // Wait for AppKit initialization if the dev process stops during startup.
    void app.whenReady().then(() => app.quit());
  };
  const check = () => {
    if (disposed) return;
    try {
      process.kill(parentPid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        quit("Parent process exited");
        return;
      }
    }
    if (pending) return;
    const probe = request(url, { method: "HEAD", agent: false }, (response) => {
      response.resume();
      failures = 0;
      lastReachable = Date.now();
      pending = undefined;
    });
    pending = probe;
    probe.setTimeout(5000, () =>
      probe.destroy(new Error("Vite probe timed out")),
    );
    probe.once("error", (error: NodeJS.ErrnoException) => {
      pending = undefined;
      // A slow transform is not proof that Vite died. Allow startup/restarts to recover.
      if (
        !["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH"].includes(
          error.code ?? "",
        )
      )
        return;
      if (!disposed && ++failures >= 2 && Date.now() - lastReachable >= 10_000)
        quit(`Dev server disconnected (${error.code})`);
    });
  };
  const timer = setInterval(check, 1000);
  timer.unref();
  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
  app.once("will-quit", dispose);
  return dispose;
}
