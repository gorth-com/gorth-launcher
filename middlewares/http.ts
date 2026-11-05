import { defineMiddleware, assertBodySize } from "nitro/h3";
import { desktopContext } from "@/lib/server/context";

export default defineMiddleware(async (event, next) => {
  event.res.headers.set("Cache-Control", "no-store");
  event.res.headers.set("Referrer-Policy", "no-referrer");
  event.res.headers.set("X-Content-Type-Options", "nosniff");
  const origin = new URL(desktopContext(event).origin);
  if (event.req.headers.get("host") !== origin.host)
    return new Response("Invalid host.", { status: 400 });
  assertBodySize(event, 1024 * 1024);
  if (!["GET", "HEAD", "OPTIONS"].includes(event.req.method)) {
    const suppliedOrigin = event.req.headers.get("origin");
    if (
      (suppliedOrigin && suppliedOrigin !== origin.origin) ||
      event.req.headers.get("sec-fetch-site") === "cross-site"
    )
      return new Response("Forbidden", { status: 403 });
  }
  return next();
});
