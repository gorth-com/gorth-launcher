// Build tooling only: import from forge.config.ts, never main/preload/renderer.
// Credentials stay in the macOS keychain; no signing secret enters the bundle.
export function getMacReleaseSigning() {
  if (process.platform !== "darwin" || process.env.GORTH_SIGN_RELEASE !== "1")
    return {};
  return {
    osxSign: {},
    osxNotarize: {
      keychainProfile: process.env.APPLE_NOTARY_PROFILE || "gorth-release",
    },
  };
}
