// Main installs its cookie-isolated Chromium transport after Electron is ready.
// Renderer/tests retain their normal platform transport.
let transport: typeof fetch | undefined;
export function installDesktopFetch(value: typeof fetch) {
  transport = value;
}
export function getDesktopFetch() {
  return transport;
}
export const desktopFetch: typeof fetch = (input, init) =>
  (transport ?? globalThis.fetch)(input, init);
