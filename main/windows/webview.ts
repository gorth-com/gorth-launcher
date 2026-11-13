import { nativeTheme, session, type BrowserWindow } from "electron";
import { allowedContentWebsite } from "@/lib/content/website";

export function installWebview(window: BrowserWindow) {
  const partition = "content-websites";
  const isolated = session.fromPartition(partition);
  isolated.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  isolated.setPermissionCheckHandler(() => false);
  // Downloads are managed by the launcher, with hashes and instance validation.
  const blockDownload = (event: Electron.Event) => event.preventDefault();
  isolated.on("will-download", blockDownload);
  window.once("closed", () =>
    isolated.removeListener("will-download", blockDownload),
  );
  window.webContents.on("will-attach-webview", (event, preferences, params) => {
    if (!allowedContentWebsite(params.src) || params.partition !== partition) {
      event.preventDefault();
      return;
    }
    delete preferences.preload;
    Object.assign(preferences, {
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
    });
  });
  window.webContents.on("did-attach-webview", (_event, contents) => {
    const syncTheme = () => {
      if (contents.isDestroyed() || !allowedContentWebsite(contents.getURL()))
        return;
      const theme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
      void contents
        .executeJavaScript(
          `(() => {
        const key = Symbol.for('gorth.project-theme');
        window[key]?.disconnect();
        const theme = ${JSON.stringify(theme)};
        const apply = () => {
          const root = document.documentElement;
          for (const value of ['dark', 'light', 'dark-mode', 'light-mode']) {
            const active = value === theme || value === theme + '-mode';
            if (root.classList.contains(value) !== active) root.classList.toggle(value, active);
          }
          if (root.dataset.theme !== theme) root.dataset.theme = theme;
          if (root.style.colorScheme !== theme) root.style.colorScheme = theme;
        };
        apply();
        const observer = new MutationObserver(apply);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
        window[key] = observer;
      })()`,
        )
        .catch(() => {
          // Navigation can destroy the old document before its update completes.
        });
    };
    contents.on("dom-ready", syncTheme);
    nativeTheme.on("updated", syncTheme);
    contents.once("destroyed", () =>
      nativeTheme.removeListener("updated", syncTheme),
    );
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    const guard = (event: Electron.Event, url: string) => {
      if (!allowedContentWebsite(url)) event.preventDefault();
    };
    contents.on("will-navigate", guard);
    contents.on("will-redirect", guard);
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });
}
