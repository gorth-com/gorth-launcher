# GitHub Releases auto-update — Gorth Launcher

## Runtime contract

About / Help now shows the installed version from Electron `app.getVersion()`, followed by:

1. **Kiểm tra cập nhật**: fetch public latest-release metadata only. No installer download.
2. **Tải bản mới**: native Electron `autoUpdater` downloads the update from the official `update.electronjs.org` feed.
3. **Khởi động lại để cập nhật**: enabled only after the native `update-downloaded` event, with a separate native confirmation dialog.

A successfully downloaded update may also install on the next normal app launch, as documented by Electron. There is no periodic download/check, background install scheduler, custom installer runner, or GitHub token in the application. Native Electron does not expose download percentage here.

Repository: [gorth-io/gorth-launcher](https://github.com/gorth-io/gorth-launcher/releases). Keep this repo **public**, with public Releases and assets. The repository choice is app-owned configuration in `utils/constant.ts`; the renderer cannot supply a repository, feed, installer URL or executable arguments.

Supported installations:

- macOS: packaged, **Developer ID signed** application; release ZIP must contain the signed app. Notarize normal distribution builds. Keep the same bundle ID and signing identity/team between versions.
- Windows: installed via Forge's **Squirrel.Windows** installer, with `Update.exe` present. Portable/uninstalled builds are disabled. Signing Windows installers is strongly recommended.
- Linux: native Electron auto-update is unavailable; use GitHub Releases/manual installation or the distribution package manager.
- Development: show version and a disabled explanation; no network or native update calls.
- Stable versions only. Draft/prerelease releases, malformed versions and downgrades are not offered.

Launcher blocks the restart action while a game or content operation is active, checking again after the confirmation dialog.
Pending authentication is cancelled only after the user confirms restart. Update operations run in main. Preload exposes only typed updater operations; IPC rejects external web pages, iframes and navigated renderers.

## Version source

Increase `version` in the root `package.json` for **every new release** (for example `0.0.2` → `0.0.3`). Do not introduce a version environment variable. The GitHub tag should be `v<version>` and must match the packaged application version.

Install the first updater-capable build manually once. Older builds without this integration cannot discover this feature by themselves.

## Build and publish

The GitHub Actions workflow in `.github/workflows/release.yml` now makes all four platform/architecture targets and uploads a complete draft release using GitHub CLI. See [Vietnamese release instructions](release-vi.md). `pnpm publish` still refers to Forge's publisher command and is not used by this workflow.

### macOS

Prepare a Developer ID Application certificate in the build machine's keychain. Store notarization credentials using Apple's tooling in a named keychain profile; never commit credentials or embed a GitHub/Apple token in app environment values.

Forge reads these **build-tool-only** values via `utils/release-environment.ts`:

- `GORTH_SIGN_RELEASE=1`: enable macOS signing and notarization. Without this flag local development packaging remains unsigned and is unsuitable for auto-update.
- `APPLE_NOTARY_PROFILE`: existing `notarytool` keychain profile name; defaults to `gorth-release`. This is a profile name, not a password.
- The signing identity is selected from the build keychain by the installed signing tooling.

Example on the respective Mac build host, after configuring its keychain:

```sh
GORTH_SIGN_RELEASE=1 APPLE_NOTARY_PROFILE=gorth-release pnpm make --platform=darwin --arch=arm64
GORTH_SIGN_RELEASE=1 APPLE_NOTARY_PROFILE=gorth-release pnpm make --platform=darwin --arch=x64
```

Upload the ZIPs generated under `out/make/zip/darwin/<arch>/`, not just a DMG or raw .app directory. Verify signatures/notarization before publishing. Asset names must contain `-darwin`, `-mac` or `-osx`, plus `-arm64`, `-x64` or `-universal`. Forge's ZIP maker already includes platform/architecture in its normal output name; retain those markers if renaming for upload.

### Windows

Build on Windows with the project's native build prerequisites:

```sh
pnpm make --platform=win32 --arch=x64
```

Upload **all** Squirrel artifacts from that build: `gorth-launcher-win32-x64-setup.exe`, `RELEASES`, and the corresponding `*-full.nupkg` (and any generated delta packages). Preserve the manifest/package names and contents. Do not use a portable EXE in place of Squirrel output.

Windows ARM64/ia32 have not been release-tested here. If adding architectures, verify the installed Squirrel toolchain and official update service support first, and avoid colliding manifest/package asset names within one release.

### Publish checklist

1. Both version and tag match; version is greater than the installed release.
2. Run typechecks, updater unit/IPC tests and native UI tests.
3. Build each target OS/architecture with the production public app configuration.
4. Verify signing and package contents; install the first build in a clean test environment.
5. Create a **draft** GitHub release, upload every intended platform artifact, then publish it as a stable release only when the set is complete. Do not expose a partly uploaded release to clients.
6. On an installed older signed version, open About → check → download → restart, and confirm the new version, persisted profile and authentication still work.
7. Test network failure, no newer release, wrong/missing artifacts and cancelled restart. Test an active game/content task on Launcher.

The runtime does not accept arbitrary release URLs, execute shell commands, or replace signing checks with its own installer. GitHub metadata checks are coalesced; native downloads cannot be triggered twice simultaneously. GitHub API limits/network failures are shown as a recoverable error.

## Verification status

Source/test TypeScript, updater state machine, trusted IPC boundaries and isolated real-Electron UI smoke tests are verified locally. The UI fixture uses synthetic release states and the actual sandboxed preload; it does **not** download or install a real update or touch a live profile.

A signed two-version GitHub Releases installation test remains required on macOS and Windows. This change does not create releases, upload files, configure signing certificates, or change repository visibility.

## Official references

- [Electron autoUpdater API](https://www.electronjs.org/docs/latest/api/auto-updater)
- [Electron updates guide](https://www.electronjs.org/docs/latest/tutorial/updates)
- [Official update.electronjs.org service and asset requirements](https://github.com/electron/update.electronjs.org)
- [Forge macOS code signing](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [Forge Squirrel.Windows maker](https://www.electronforge.io/config/makers/squirrel.windows)

