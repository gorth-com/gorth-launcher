import type { H3Event } from "nitro/h3";
import { desktopContext } from "@/lib/server/context";

export function actGetUserProfile(event: H3Event) {
  const desktop = desktopContext(event);
  const identityId = desktop.getIdentityId();
  if (!identityId)
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  const profile = desktop.getUserProfile(identityId);
  return profile
    ? Response.json({ profile })
    : Response.json({ error: "profile_not_found" }, { status: 404 });
}
