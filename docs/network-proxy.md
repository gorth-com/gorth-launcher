# Network proxy

Settings → Proxy is available in both desktop applications.

- System follows the operating-system proxy. None uses direct connections.
- HTTP and SOCKS5 accept a hostname/IP and port. HTTP authentication is optional; SOCKS5 authentication is not supported.
- Apply closes active Electron connections. Downloads and sign-in may need retrying.
- The setting covers Electron tabs/webviews and app-owned main HTTP requests (including the injected Better Auth transport and update metadata). It does not configure an external sign-in browser, operating-system updater installers, or the Minecraft child process.
- Loopback remains direct for the local desktop server, RPC and OAuth callback.
- Show applied route resolves the saved route for example.com. It is not a connectivity or credential-validity test.
- Credentials are encrypted with Electron safeStorage and never returned to the renderer. Saving credentials is refused when a secure system keychain is unavailable; plaintext Linux basic_text storage is refused.
- Config lives at userData/network-proxy.json, with encrypted credentials only. Changing endpoint or leaving HTTP mode clears saved credentials.
- Known webview partitions are initialized before navigation. New native session consumers must await prepareSession before starting requests; the session-created event alone is asynchronous.
- App requests use a dedicated nonpersistent network session so ordinary browser cookies are not attached.
- Invalid persisted configuration fails startup instead of silently connecting directly.

IPC only accepts the trusted main renderer frame. Proxy host/port inputs are validated and no arbitrary diagnostic destination is accepted. Existing download redirect/checksum safeguards remain enabled.

Verification:

- tests/vitest/proxy.test.ts: schema and proxy rule validation.
- tests/vitest/proxy-native.test.ts: actual Electron/local proxy, persistence, future session preparation, loopback bypass, cookie isolation and Axios redirect rejection.
- The native test uses a temporary profile and no public network destinations. System proxy/PAC behavior and password-protected proxies are not covered by that fixture.

Platform references:

- https://www.electronjs.org/docs/latest/api/session
- https://www.electronjs.org/docs/latest/api/safe-storage
- https://chromium.googlesource.com/chromium/src/+/main/net/docs/proxy.md
