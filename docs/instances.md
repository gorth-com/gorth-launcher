# Instance pages

- `gorth://instances`: instance list (legacy `gorth://library` redirects here).
- `gorth://instances/create`: dedicated workspace with a state-driven source sidebar.
- `gorth://instances/data` and legacy `gorth://instance-data`: compatibility entry points into Notes in the selected instance editor, or Instances when the library is empty. They are not separate management pages anymore.
- `gorth://instances/edit/<uuid>`: dedicated editor for that instance. Sidebar panels keep the same instance URL; missing instances show an empty state with a return action.
- `gorth://gallery`: compatibility entry point into Screenshots for the selected instance. The former gallery previews/search/open/reveal/delete actions now live in the editor; there is no separate Gallery sidebar item.

## Instance workflow

- Home only contains quick play (instance/account selection, Play/Stop) and six unique recently played instances.
- Instances is the only full management list, with search/filter/grid/list and no secondary instance selector.
- Edit owns runtime, per-instance settings, installed content, data, screenshots and logs. Child tools are pinned to its UUID and do not show redundant instance selectors.
- Content/Mods/Modpacks/Resource Packs/Shaders search and install online content only; installed-content management lives in Edit. Browse/install from an editor preserves that instance as the target.
- Downloads contains task status, progress, pause/resume/cancel/stop and links to Console and Launch History, not copies of the log/history views.
- The renderer root owns a shared selection across Home, Edit, Content and Console. Editor URLs synchronize that selection; deleting the chosen instance falls back to an existing instance. Legacy tool redirects replace history so Back does not bounce through the old URL.
- Console still has a global view for choosing a process and an instance-pinned view in Edit/native console windows. A selected instance without a job never falls back to another game's output.
- Live console output and archived logs compose `@gorth/primitive/default/code-block` through `LogViewer`. Plain text remains escaped; no highlighter or HTML injection is used for streaming logs. Font is self-hosted JetBrains Mono SemiBold (600), 13px; the original OFL license ships in `public/fonts/jetbrains-mono/`.
- Instances and Notifications counts use `SidebarMenuBadge` with `size-6`.

Verification: `pnpm exec vitest run tests/vitest/instance-surfaces.test.tsx tests/vitest/instance-workflow-native.test.ts` covers reduced page surfaces, legacy destinations, shared selection, screenshots, sidebar badge dimensions, escaped log text and actual Electron font loading. The native fixture always uses a temporary profile, never the user's data.

Create supports Custom, existing archive/folder import, Modrinth and CurseForge modpacks. Import/runtime capabilities remain those of the current engine; unsupported sources/loaders and snapshot versions are not advertised as working.

Custom creation validates name, runtime, group and a whitelisted Lucide icon in both renderer and main. Metadata is inserted together in SQLite. Existing image icons remain supported; Lucide icons use the `lucide:` marker in the existing icon field, without a database migration.

Create/Edit/Data preserve titlebar, navigation controls, Back, account footer, auth overlay, tooltips and confirmation/toast portals. Filesystem, game execution and import/export remain behind existing IPC APIs. Saved shortcut action identifiers are preserved; navigation maps legacy identifiers to canonical pages.
