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
  const quit = () => {
    if (disposed) return;
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
        quit();
        return;
      }
    }
    if (pending) return;
    const probe = request(url, { method: "HEAD", agent: false }, (response) => {
      response.resume();
      failures = 0;
      pending = undefined;
    });
    pending = probe;
    probe.setTimeout(1000, () =>
      probe.destroy(new Error("Vite probe timed out")),
    );
    probe.once("error", () => {
      pending = undefined;
      if (!disposed && ++failures >= 2) quit();
    });
  };
  const timer = setInterval(check, 1000);
  timer.unref();
  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
  app.once("will-quit", dispose);
  return dispose;
}
