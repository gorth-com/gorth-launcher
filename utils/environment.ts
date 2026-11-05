/// <reference types="vite/client" />
// Public configuration only. Vite injects these values; native fixtures use the
// same keys from the process environment. OAuth secrets stay on the website.
// Forge owns the renderer origin in dev. Use the same origin for the window,
// trusted IPC sender and private Hono endpoint. Forge preStart loads .env.local
// into the development main process; packaged apps use their runtime environment.
export const appUrl =
  typeof MAIN_WINDOW_VITE_DEV_SERVER_URL === "string" &&
  MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL
    : (import.meta.env?.VITE_PUBLIC_APP_URL ??
      process.env.VITE_PUBLIC_APP_URL ??
      "");
export const authUrl =
  import.meta.env?.VITE_PUBLIC_AUTH_URL ??
  process.env.VITE_PUBLIC_AUTH_URL ??
  "";
export const oauthClientId =
  import.meta.env?.VITE_PUBLIC_OAUTH_CLIENT_ID ??
  process.env.VITE_PUBLIC_OAUTH_CLIENT_ID ??
  "";
export const elyClientId = process.env.ELY_CLIENT_ID ?? "";
export const javaHome = process.env.JAVA_HOME ?? "";
export const curseforgeApiKey = process.env.CURSEFORGE_API_KEY ?? "";

export function getJavaEnvironment(
  custom: Record<string, string> = {},
  gpu: "default" | "high-performance" | "integrated" = "default",
) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /^(JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|_JAVA_OPTIONS|CLASSPATH|CURSEFORGE_API_KEY)$/i.test(
        key,
      )
    )
      delete env[key];
  }
  Object.assign(env, custom);
  if (process.platform === "linux" && gpu === "high-performance") {
    env.DRI_PRIME = "1";
    env.__NV_PRIME_RENDER_OFFLOAD = "1";
    env.__GLX_VENDOR_LIBRARY_NAME = "nvidia";
  } else if (process.platform === "linux" && gpu === "integrated") {
    env.DRI_PRIME = "0";
    delete env.__NV_PRIME_RENDER_OFFLOAD;
    delete env.__GLX_VENDOR_LIBRARY_NAME;
  }
  return env;
}
