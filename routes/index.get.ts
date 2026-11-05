import { defineHandler } from "nitro";
import { desktopContext } from "@/lib/server/context";
export default defineHandler((event) =>
  desktopContext(event).development
    ? new Response("Not Found", { status: 404 })
    : Response.redirect(new URL("/public/index.html", event.req.url), 302),
);
