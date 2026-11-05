import type { H3Event } from "nitro/h3";
import type { DesktopRequestContext } from "@/lib/server/interface";

export function desktopContext(event: H3Event): DesktopRequestContext {
  const context = event.context.desktop as DesktopRequestContext | undefined;
  if (!context) throw new Error("Missing desktop request context");
  return context;
}
