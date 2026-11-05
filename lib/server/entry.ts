import { useNitroApp } from "nitro/app";
import type { DesktopRequestContext } from "@/lib/server/interface";

// Electron owns identity, the callback registry and the listener lifecycle.
// Passing context in-process preserves a single copy of that state.
export async function fetch(request: Request, desktop: DesktopRequestContext) {
  Object.assign(request, { context: { desktop } });
  const response = await useNitroApp().fetch(request);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
