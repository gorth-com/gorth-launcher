import path from "node:path";
import { pathToFileURL } from "node:url";
import { receiveAuthCallback } from "@/services/auth-callback";
import { getUserProfile } from "@/services/user-profile";
import type {
  DesktopRequestContext,
  DesktopServerOptions,
} from "@/lib/server/interface";

interface BackendModule {
  fetch: (
    request: Request,
    context: DesktopRequestContext,
  ) => Response | Promise<Response>;
}
export function createDesktopHandler(options: DesktopServerOptions) {
  const entry = pathToFileURL(
    path.join(options.applicationDirectory, ".vite/server/index.mjs"),
  ).href;
  let backend: Promise<BackendModule> | undefined;
  const context: DesktopRequestContext = {
    ...options,
    receiveAuthCallback,
    getUserProfile,
  };
  const fetch = async (request: Request) => {
    backend ??= import(/* @vite-ignore */ entry) as Promise<BackendModule>;
    return (await backend).fetch(request, context);
  };
  return { fetch };
}
