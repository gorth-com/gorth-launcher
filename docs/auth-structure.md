# Launcher: Better Auth Electron

Identity belongs to Gorth SSO. The desktop app has its own native Better Auth session on the corresponding website backend; it does not share the browser's cookie or the central SSO session.

```text
Electron main.requestAuth()
  → Launcher Website /auth/desktop
  → Generic OAuth gorth (prompt=select_account) → Gorth SSO
  → website /auth/callback/gorth → /auth/desktop/complete
  → electronProxyClient.ensureElectronRedirect()
  → com.gorth.launcher://auth/callback#token=…
  → Electron SDK authenticate() → native app session
```

## Login browser selection

Settings → Tài khoản → Trình duyệt đăng nhập offers `Default browser` (the
default) and `Gorth Browser`. The non-secret preference is saved in the app's
`login-browser.v1.json`; changing it does not read the encrypted account vault,
unlock Keychain or change the OS default browser.

The normal path uses Better Auth Electron's website `signInURL`. With Gorth
selected, SDK `requestAuth()` instead opens a `com.gorth.browser://auth/open`
routing envelope carrying the same Launcher Website destination. Better Auth
still creates PKCE/state; Browser unwraps the public navigation parameters and
opens the website in a normal sandboxed tab. The website continues through
Generic OAuth, SSO account selection and the official Electron redirect. Browser
relays the resulting `com.gorth.launcher://auth/callback` to Launcher's OS handler;
the existing Launcher SDK validates/exchanges it and stores its native session.

This is custom OS-navigation glue because SDK 1.7.9 has no custom opener option;
it is not a replacement for Better Auth's authentication logic. No provider,
PKCE verifier, token exchange or credential storage is reimplemented. Existing
cancel/timeout, explicit Keychain unlock and app-only logout remain in effect.

Restart both apps after updating. Gorth Browser must be installed and registered
for its deep link. In development it must already be running; the macOS dev
handler does not start Forge. If unavailable, choose `Default browser` and retry.
There is no silent fallback. No new env, package or database changes are required.

Reference: [official Electron integration](https://better-auth.com/docs/integrations/electron).

## Environment

### macOS development callbacks

The stock Electron development bundle cannot register an application-specific
URL scheme through executable arguments; those arguments are Windows-only.
Before opening login, `main/services/auth-protocol.ts` prepares the OS callback.
On macOS development builds it generates a small branded applet under the app's
`userData/development-auth` directory and registers only this application's auth
scheme with LaunchServices. The applet forwards the callback over a private Unix
socket to the already-running main process. It does not start another Electron,
replace the OAuth flow, read browser cookies, or change the default browser.

The socket is user-only, bounded to 4096 bytes, and closes with the application.
The existing pending-attempt checks and Better Auth SDK still validate and
exchange the callback using SDK-owned PKCE/state. Packaged macOS builds continue
using Forge's declared protocol handler; Windows development registration
includes the absolute application entry. Registration failure prevents opening
an OAuth flow that cannot return to the application.

After updating, stop and restart Forge, cancel any previously pending login, and
start a new login. No environment or database migration is required.

### Variables

During development, Forge's `MAIN_WINDOW_VITE_DEV_SERVER_URL` is the source of truth for the window, trusted IPC sender and private Nitro endpoint. `VITE_PUBLIC_APP_URL` configures the packaged application. Auth still requires the current `VITE_PUBLIC_AUTH_URL` and `VITE_PUBLIC_OAUTH_CLIENT_ID` keys from `.env.example`; restart Forge after changing environment files.

| Context                           | Variable                                  | Local value                                     |
| --------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| Desktop renderer/main             | VITE_PUBLIC_APP_URL                       | http://localhost:5502                           |
| Desktop auth backend              | VITE_PUBLIC_AUTH_URL                      | http://localhost:5504                           |
| Native SDK client ID              | VITE_PUBLIC_OAUTH_CLIENT_ID               | gorth-launcher                                  |
| Website SSO origin                | NEXT_PUBLIC_AUTH_URL                      | http://localhost:3000                           |
| Website OAuth client ID           | NEXT_PUBLIC_OAUTH_CLIENT_ID               | gorth-launcher-website                          |
| Website app origin                | NEXT_PUBLIC_APP_URL                       | http://localhost:5504                           |
| Website private secret            | NEXT_SESSION_SECRET                       | Existing secret value; never expose it          |
| Website Minecraft texture signing | NEXT_MINECRAFT_SIGNING_PRIVATE_KEY_BASE64 | Private RSA PEM encoded as base64, backend only |

There are no old SSO_* or VITE_APP_URL aliases. Keep the existing website secret when renaming NEXT_AUTH_SECRET to NEXT_SESSION_SECRET, because OAuth account tokens were encrypted with it. Configure production origins with HTTPS. The website must be running when signing in or verifying a native session.

## Boundaries

- Main owns the official SDK, OS protocol registration and SDK safeStorage-encrypted credentials.
- Preload exposes only the existing narrow account commands and public profile snapshots. Main checks the owned window, main frame and exact application renderer URL.
- SDK broad IPC bridges/CSP overrides are disabled so external web contents cannot invoke privileged SDK actions and existing browser content-blocker/CSP handlers remain intact.
- Login and account switching always start a new Generic OAuth request with account selection. A saved website session is not silently transferred.
- Callback codes, cookies, OAuth tokens and PKCE verifiers never cross the application's renderer IPC bridge.
- Local API identity uses verified SSO externalUserId/sub, not the website-local user UUID.
- Native pending login expires at 120 seconds. Cancellation fences late callbacks. Background app-session verification does not show the whole-app loading screen.
- Startup reads public snapshots only; it never automatically sends `launcher.unlock`.
  Saved native/game credentials stay locked until a user explicitly signs in or
  chooses to unlock the saved session. Polling, focus and automatic 401 refresh
  must not unlock a session that has not been opened in this process.
- Logout uses the official native signOut endpoint, removes the saved native credential, and never calls SSO end-session. The website's independent browser session remains valid.

## Migration

The previous custom OAuth browser vault is not imported into a native SDK session. Sign in once after upgrading. Existing SQLite tabs, groups, bookmarks and public profile cache are untouched. Launcher offline game profiles keep their separate encrypted vault.

No cloud schema change or SSO OAuth callback update is required for this integration. The Electron plugin uses the website's existing verification and session tables. Existing website Generic OAuth callbacks remain /auth/callback/gorth.

That statement applies to native authentication only. The new Minecraft game feature additionally requires the Launcher Website's `database/migrations/20261016-user-dashboard.sql` and a stable server-only RSA signing key. It does not modify SSO's schema. See [auth.md](auth.md#provider-contracts) for the native-session-to-game bridge.

## SDK 1.7.7 compatibility

The package's declarations advertise kElectron, but its JavaScript client does not export it. Cancellation currently clears the SDK-owned PKCE map through its shared symbol; no application code generates or verifies PKCE. Recheck this small compatibility boundary when upgrading the paired Better Auth/Electron SDK versions. Native tests cover cancellation, timeout, account switching and server-side session deletion.

## Verification

- pnpm test (Vitest, including isolated real Electron windows)
- pnpm test:auth
- pnpm test:auth:ui
- pnpm test:server
- pnpm exec tsc --noEmit

Reference: [official Electron integration](https://better-auth.com/docs/integrations/electron).

# Keychain at startup

After Electron readiness, the owning app instance initializes the synchronous
`safeStorage` encryptor used by the Better Auth SDK. This accesses the OS key even
without a saved session; the encrypted probe is discarded and no credentials are
read, rewritten or created. macOS decides whether a permission dialog is needed.
If access is denied, the app reports it and continues without deleting data or
falling back to plaintext. Session unlocking and verification remain separate
auth operations; startup key access does not imply a verified signed-in user.
