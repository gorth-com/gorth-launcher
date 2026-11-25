"use client";

import axios from "@gorth-com/structure/cores/axios";
import { createAuthRetry } from "@gorth-com/structure/modules/auth/client";

const retry = createAuthRetry({
  refresh: refreshAuthentication,
  getStatus: (error) =>
    axios.isAxiosError(error) ? error.response?.status : undefined,
});

export function resetCallerAuthentication() {
  retry.reset();
}

export function withAuthRetry<T>(
  request: () => Promise<T>,
  _getStatus: (error: unknown) => number | undefined,
  enabled = true,
) {
  return retry.withAuthRetry(request, { enabled });
}

export async function refreshAuthentication() {
  try {
    const result = await window.electronAPI.auth.command({
      action: "launcher.refresh",
    });
    return result.ok;
  } catch {
    return false;
  }
}
