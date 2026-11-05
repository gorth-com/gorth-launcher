# Launcher authentication

The launcher identity and selected Minecraft account are separate. The maintained Better Auth Electron flow and current environment contract are documented in [auth-structure.md](auth-structure.md). Offline profiles remain available. Native Gorth Minecraft profiles are now supported through the Launcher Website after its dashboard migration and signing-key setup; Ely.by login stays disabled. No Microsoft login or licence flow is implemented.

The historical OAuth configuration below predates the Better Auth Electron migration. Do not copy its old variable names or callback setup; use `.env.example` and the maintained document above.

## Configuration

Set the VITE_SSO_* and VITE_APP_URL public client variables from `.env.example` before dev/build. OAuth configuration is consumed by main; tokens never enter the renderer. No client secret is used.

- `VITE_SSO_OAUTH_CLIENT_ID`: `gorth-launcher`.
- `VITE_SSO_CLIENT_URL`: SSO frontend origin, e.g. `http://localhost:3000`; issuer is `<origin>/auth` and discovery is `<origin>/auth/.well-known/openid-configuration`.
- `VITE_SSO_SERVER_URL`: SSO backend origin, e.g. `http://localhost:8080`; OAuth uses the frontend's existing `/auth` proxy.
- `VITE_APP_URL`: `http://localhost:5502`; registered redirect is `<origin>/auth/callback`.

Production UI uses an embedded, sandboxed WebContentsView in the existing launcher window. Main intercepts the exact registered callback before navigation and validates it directly; no external browser, popup or new window is used. The legacy /auth/callback HTTP contract remains available through Nitro and the main-owned callback registry; the current Better Auth Electron flow continues to use native deep links. Vite forwards domain routes to main over a private OS socket/named pipe in dev, without a second TCP port. Packaged Nitro serves the renderer and domain routes on the configured app port. VITE_SSO_ACCESS_TOKEN/REFRESH_TOKEN/SESSION_APP and VITE_SSO_OAUTH_* transaction names are exported names, not credentials; desktop OAuth tokens remain in the encrypted vault and transaction state stays in main memory. SSO's own HttpOnly cookies live in a dedicated Electron session partition.

Gorth SSO needs a client registration with:

- public: true; token_endpoint_auth_method: none; require_pkce: true;
- grant_types: authorization_code, refresh_token; response_types: code;
- application_type: native; scopes: openid, profile, email, offline_access;
- redirect_uris: the exact configured loopback callback.

The SSO repository includes both desktop clients in `server/database/seeds/oauth-clients.json` and an explicit `pnpm --dir server db:seed:desktop-clients` command. It inserts missing clients without overwriting existing ones. On 2026-10-05 both clients were inserted and read back from the configured SSO database. No central SSO secrets belong in a desktop application. Database registration does not prove live user login.

## Provider contracts

Offline profiles validate 3–16 ASCII letters/digits/underscore and use the Java-compatible MD5 name UUID of `OfflinePlayer:<name>`. This is a local profile, never a launcher identity or an authenticated online session.

Login opens the existing SSO sign-in page inside the launcher; registration uses `prompt=create` like Chat and keeps the SSO registration/OTP/consent flow intact. Password reset and verification stay owned by SSO. The native view has no preload or Electron bridge, denies permissions/downloads, blocks foreign navigation, and always denies new-window requests. Allowed Gorth links remain in the same view. Single-use state and callback issuer are verified in main, with a three-minute login timeout and ten-minute registration timeout. PKCE S256 and signed ID-token verification remain required. Cancel or closing the parent destroys the auth view and aborts the transaction.

`AuthProvider` mounts once at renderer root. `useAuth()` exposes `account`, `username`, `authenticated`, `loading`, `locked`, `error`, `login`, `register`, `logout`, `refresh`, `unlock`, `cancel`, plus existing launcher `auth/run/busy/ready` APIs. `useUser()` exposes the verified public profile and loading/error/refresh helpers; `useAccount()` returns the public account. No hook returns an OAuth token. A single controller refreshes near-expiry unlocked sessions and on window focus. `AuthGuard` is opt-in so Offline play remains available without SSO.

The Gorth game bridge uses the same website origin as native Better Auth. Main reads its SDK-owned cookie with `getCookie()` and calls `GET /minecraft/me` and `POST /minecraft/session`. No password is accepted or forwarded. The website authenticates a fresh, centrally bound native session and issues a separate opaque Minecraft credential. It never returns an OAuth token to the game.

Create a unique Minecraft name at the website's `/user` page, upload and activate a skin at `/user/skin`, and explicitly enable skin publication in `/user/settings` → Privacy if desired. Refresh the native session to synchronize the game profile. Before each Gorth game launch, main obtains a new short-lived game credential and uses the existing verified authlib-injector installer. The root is `<website-origin>/minecraft`; no separate game URL environment variable is needed. Profile renames preserve the game UUID but revoke previous game sessions. Native logout also invalidates the parent-bound game credentials.

The participating game server must use the same authlib-injector root with `online-mode=true`. Trusted client-IP attestation and Mojang chat-signing certificates are not implemented; see the website's `/user/server` page for the explicit server-policy limitations. Microsoft/Mojang-only servers do not accept Gorth identities. Ely.by integration remains disabled.

## Storage and lifecycle

Main process stores `auth.v1.enc` under Electron userData using OS-backed Electron safeStorage and atomic writes with mode 0600. It fails closed if encryption is unavailable, including Linux basic_text. No passwords are persisted. IPC only returns allowlisted public profile fields; access, refresh, client and device tokens never reach the renderer.

Startup accesses the OS encryption key through safeStorage, so macOS can ask for Keychain permission as the app opens. This does not decrypt the account vault or verify a session; use Unlock saved session or Sign in for that. Denied access preserves the vault and allows retry. Native session verification and sign-out use the official Better Auth SDK. Signing out clears this app's local credential without ending other desktop/web app sessions. Network failure does not restore the local session.

The launch engine calls `resolveGameSession()` before spawning Java. Offline and native Gorth game profiles are supported; only main receives the resulting credential. Gorth SSO tokens are never used as Minecraft credentials. Java log collection redacts the exact game credential before renderer publication.

The initial window is shown independently of renderer readiness. Failed initial Vite loads are caught and retried up to three times, rather than leaving a hidden window that requires CLI rs.

## Verification

`pnpm test:auth` tests offline UUIDs, input/config validation, token rotation, local mocked Gorth OIDC including bad state/signature/issuer/audience/nonce/expiry/hash/userinfo subject, revocation, refresh consistency, cancellation, and vault/IPC safety. Legacy Ely/Yggdrasil adapter tests remain, but their product entry points are disabled. Mock tests do not prove live provider registration or login. Real Gorth accounts and configured clients are needed for end-to-end verification.

`pnpm test:auth:embedded` runs hidden Electron windows using temporary app data against local SSO 3000/8080. It verifies that both live login/signup forms render, checks sandbox/no bridge, denies popup creation, and tests cancellation/cleanup without credentials or creating accounts. Live form tests and mocked code exchange passed on 2026-10-05. A real user's password/OTP submission is not automated by these tests.

## Nitro routes and local profile cache

HTTP boundaries are organized as `routes -> controllers -> services`.
`GET /auth/callback` validates the exact origin/path and the active transaction's
state/issuer, consumes it once, and exchanges the authorization code only in main.
No request logger prints callback URLs. `GET /health` exposes only an OK status.
`GET /user/profile` requires a per-run desktop capability and an unlocked, valid
SSO session; the subject is resolved from main state, not a supplied ID.
Foreign Host/Origin requests are rejected. Public identity caching never grants
authentication or access to another cached account.
The narrow preload API `window.electronAPI.auth.profile()` returns this public
cache (or null without a valid session); its per-run capability remains inside
the isolated preload world.

`database/schema.ts` defines `user_profile` with `sso_user_id` as its primary
key, plus name, username, email, image, email verification, creation/sync times.
Verified login and refresh upsert only these public identity fields, preserving
creation time across email/username changes. Logout retains the profile cache
but removes authentication; no password, OTP, access/refresh/ID token is saved
in this table. Tokens remain in the existing safeStorage-encrypted vault.
The additive SQLite migration preserves existing data and runs on startup.

`services/desktop-server.ts` starts/stops Nitro with Electron. Vite and Nitro share
one public HTTP origin per app (Browser 5501, Launcher 5502). In dev there is an
internal OS IPC endpoint, not another HTTP port; main alone owns database/vault
access. Packaged Nitro binds loopback and serves only built renderer assets.
An occupied public port fails startup rather than silently changing the callback.
Filesystem, process and SQLite APIs still use Electron's Node runtime; Nitro
replaces HTTP request handling, not those privileged platform capabilities.

Verification:

- `pnpm test:auth`: signed mock OIDC/PKCE/HTTP callback, vault/IPC and native view guards.
- `pnpm test:server`: additive cache writes, identity-key updates, existing-data preservation, route access guards and callback replay.
- `pnpm test:server:native`: temporary-profile Electron smoke test of packaged assets/API, sandboxed profile access, logged-out cache behavior and same-port Vite/Nitro routing.
- `pnpm test:auth:embedded`: live local SSO forms, sandbox, no popups and cancellation.

Actual account credentials, OTP mail delivery and a completed real-user SSO login
remain manual verification; these tests do not create a central SSO user.

## Auth tab and completion

Launcher opens the sandboxed SSO webview within the existing window, with a read-only address bar and return/reload controls. No popup or external browser is created.

Normal login and account switching send `prompt=select_account`, so an existing
SSO session cannot silently choose the previously active account. App logout
leaves SSO signed in; logging in again still requires explicit account selection.
Registration continues to send `prompt=create`.

`gorth://auth` is an internal completion page, not the registered OAuth callback.
The exact HTTP callback on the app port stays unchanged. A successful screen is
marked only after token validation, profile synchronization and encrypted vault
storage; receiving an authorization code alone is not success. Native view URLs
sent to the UI exclude all query parameters, so codes/state do not enter tab
persistence. Cancellation and failed validation never set the completion marker.

After verified completion, the auth webview displays `gorth://auth` for 500 ms,
then closes and opens the account/profile page (`gorth://settings/profile`,
the renderer's existing `accounts` page). Back cancels an active transaction
and opens this same page. The auth addressbar is h-14, input/buttons h-9, and
back is icon-only with an accessible label.

Renderer regression: run `pnpm exec vite build`, then `pnpm test:auth:ui`.
The test uses a credential-free Electron renderer fixture to check bar/input
dimensions, back navigation, successful automatic return, failure staying put,
and no popup.
