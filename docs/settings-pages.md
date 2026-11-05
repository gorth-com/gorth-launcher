# Settings pages

New pages reuse the existing full-window Settings layout, sidebar, headings and primitives.

- General: instance sorting by name/last launch, retained game console lines and opening the app-managed folders. Changing the folder root is not implemented.
- Language: regional format for dates in Launch History; not full UI translation.
- Services: links to the existing Gorth profile/session, game account and content-provider pages. Does not add new providers or expose credentials.
- Tools: stores executable paths for a text editor, MCEdit, JProfiler and VisualVM, with native file selection and file-access checks. Does not execute the tools, verify their product/version or attach profilers to Minecraft.
- Proxy: see network-proxy.md.

Appearance, content, shortcuts, Gorth profile, trash, history and about are reused rather than duplicated. Java keeps settings/runtime; Minecraft keeps settings/instance and now edits global defaults. Per-instance overrides remain in the instance editor.

Preferences are stored through the existing validated library settings API. Java/Minecraft reset buttons reset their respective form; Save commits the reset without changing unrelated preferences. Sorting applies to the Instances list. The console limit is applied when game output arrives. See java-minecraft-settings.md for runtime options and limitations.

The reference screenshots also show options without current engine support, such as rename-folder policies, global task/download limits and profiler attachment. No nonfunctional toggles were added for those.
