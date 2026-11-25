// Renderer-only startup boundary: native unlock must wait for the app shell.
let release: (() => void) | undefined;
const ready = new Promise<void>((resolve) => {
  release = resolve;
});
export function notifyApplicationReady() {
  release?.();
}
export function waitForApplicationReady() {
  return ready;
}
