# Java and Minecraft settings

Java (settings/runtime) and Minecraft (settings/instance) retain the existing full-window Settings layout. Changes are explicit: edit, then Save. Preferences are validated and persisted by the existing library service; saved instance overrides are not overwritten.

## Java

- General and Installations tabs.
- Executable selection, bounded installed-runtime discovery, native Browse, Refresh and Use.
- Required-major selector for Test settings. The test executes the selected binary directly, without a shell, with a 15-second timeout and bounded output. It checks version/architecture unless compatibility checks are disabled, then probes configured JVM/collector flags with -version without allocating the configured heap.
- Skip compatibility checks only bypasses local runtime compatibility checks, not file validation, download hashes or download-origin policy.
- Skip setup prompt controls the once-per-start prompt when there is no configured or detected local Java.
- Auto-detect selects an installed matching Java version; a mismatched configured runtime falls back to discovery only when auto-detection is enabled.
- Auto-download Mojang Java changes the download source. Otherwise the existing Temurin downloader remains available. Existing suitable runtimes are reused. Mojang uses official runtime metadata, validates the manifest and raw-file SHA-1/size, restricts destinations and symlinks to staging, and checks the executable before publishing the runtime. Unavailable platform/component combinations produce an error, not a silent architecture fallback.
- Minimum/maximum memory are specified in MiB. Fractional-GB instance memory remains supported at MiB precision. Free-memory warnings are confirmed before launching.
- Mojang optimized defaults, GC presets (None/G1/Shenandoah/ZGC), a generated-arguments preview and custom arguments (one per line). Global custom arguments precede instance custom arguments.
- PermGen is displayed disabled: it was removed in Java 8 and is not a valid option for supported runtimes. No PermGen flag is generated. GC availability depends on the chosen Java build; use Test settings.

## Minecraft

- General, Tweaks, Custom Commands and Environment Variables tabs.
- Ely.by patch Never / eligible accounts / Always. Existing Gorth authlib bindings always take priority. This installs the Ely.by integration for otherwise eligible launches; it does not enable the currently unavailable Ely.by sign-in implementation.
- Window dimensions. Maximized sizes the game window to the launcher's display work area; this is not OS-level maximize automation. Explicit per-instance fullscreen takes priority.
- Hide launcher after successful Java process spawn; restore it when the game exits. Quit-on-exit applies only when no other launcher game task remains.
- Show console on launch/crash, hide on normal exit. Console is a separate Electron window using the existing ConsolePage and preload. It is reused per instance and preserves contextIsolation, sandbox and disabled nodeIntegration.
- Record play time controls future local history records. Show-instance-time and show-total-time control the instance list/Home/Downloads/History displays. The hours preference formats durations without changing stored milliseconds.
- Global GPU/native library defaults, pre-launch/post-exit commands and environment variables. Existing per-instance values take priority. Commands remain direct executable invocation, not shell expressions, and existing Java environment filtering remains enabled.

## Verification

- Unit tests: preference validation and precedence, SQLite persistence/reopen, JVM argument assembly, selected executable probing, mocked/hash-verified Mojang installation and path traversal rejection.
- Real Electron fixtures: saving Java/Minecraft settings in dev and production, all tabs, preserved existing UI, and native console open/reuse/hide/restore with an isolated temporary profile.
- No real Minecraft session, live account, or full production runtime download is launched by these fixtures. Public Mojang metadata was checked separately.

References:
- https://docs.oracle.com/en/java/javase/17/docs/specs/man/java.html
- https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json
- https://docs.ely.by/en/authlib-injector.html
