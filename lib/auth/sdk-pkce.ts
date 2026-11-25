// Compatibility boundary for @better-auth/electron 1.7.21. requestAuth()
// returns void and has no cancellation API; kElectron is not a runtime export.
// Only inspect request ownership and remove this attempt's outstanding keys.
// The SDK still generates verifiers and performs the PKCE token exchange.
const key = Symbol.for("better-auth:electron");

function pendingPkce() {
  const value = (globalThis as typeof globalThis & { [key]?: unknown })[key];
  return value instanceof Map ? (value as Map<string, string>) : undefined;
}

// Call immediately before requestAuth(), inside the serialized browser opener.
// Do not reuse across attempts or clear the SDK's entire shared map.
export function createSdkPkceFence() {
  const previous = new Set(pendingPkce()?.keys());
  return {
    accepts(token: string) {
      try {
        const decoded = JSON.parse(
          Buffer.from(decodeURIComponent(token), "base64url").toString("utf8"),
        ) as { state?: unknown; identifier?: unknown } | null;
        return (
          typeof decoded?.state === "string" &&
          typeof decoded.identifier === "string" &&
          !!decoded.identifier &&
          !previous.has(decoded.state) &&
          !!pendingPkce()?.has(decoded.state)
        );
      } catch {
        return false;
      }
    },
    clear() {
      const cache = pendingPkce();
      for (const state of cache?.keys() ?? [])
        if (!previous.has(state)) cache?.delete(state);
    },
  };
}
