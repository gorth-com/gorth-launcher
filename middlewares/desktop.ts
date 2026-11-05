import { timingSafeEqual } from "node:crypto";
import type { H3Event } from "nitro/h3";
import { desktopContext } from "@/lib/server/context";

export function requireDesktop() {
  return (event: H3Event) => {
    const { capability, origin } = desktopContext(event);
    const supplied = Buffer.from(
      event.req.headers.get("x-gorth-desktop-session") ?? "",
    );
    const expected = Buffer.from(capability);
    const requestOrigin = event.req.headers.get("origin");
    if (
      !expected.length ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected) ||
      (requestOrigin && requestOrigin !== new URL(origin).origin) ||
      event.req.headers.get("sec-fetch-site") === "cross-site"
    )
      return Response.json({ error: "forbidden" }, { status: 403 });
  };
}
