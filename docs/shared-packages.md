# Shared packages in the desktop app

The app consumes the published GitHub sources for `@gorth/primitive`,
`@gorth/principle`, and `@gorth/structure`, matching SSO. The resolved commits
are recorded in `pnpm-lock.yaml`.

- Prefer `@gorth/primitive/custom/<component>`. When there is no custom
  equivalent, use `@gorth/primitive/default/<component>`.
- Dropdown and radio exports are named `custom/dropdown` and `custom/radio`.
- Import `cn` from `@gorth/primitive/cores/cn`, icons from `cores/lucide`,
  and TanStack APIs from `cores/tanstack/<package>`.
- Axios/Zod belong to Structure's `cores/axios` and `cores/zod`; main-process JOSE uses Principle's `cores/jose`. HTTP desktop routing and the Node adapter use Nitro/H3; no direct Hono dependency is required.

`components/ui` and the local `cn` bridge have been removed.
`app/renderer.tsx` imports `styles/globals.css`, the application CSS entry
combining Tailwind, Primitive's global CSS, the font and `styles/internals.css`.
Source scanning is scoped to application and test folders; theme tokens remain
owned by Primitive. `internals.css` only contains desktop-specific styling.
No virtual CSS plugin is needed. Window dragging uses Tailwind arbitrary
`-webkit-app-region` utilities.

Keep the Electron portal providers: DOM-only popups cannot render above native
WebContentsView content. The local tooltip surface adds native portal hooks,
theme colours, and the bordered arrow to Primitive's tooltip primitives.
Toast presentation/manager comes from `custom/toast`, with desktop-specific
positioning and 200ms transitions supplied by the provider.

The local virtualized DataTable and Ranger remain application components,
composed from shared UI and TanStack exports. Primitive's published
`custom/data-table` imports `@bprogress/next` and has a different API; importing
it here would reintroduce a Next.js dependency into the renderer.
Do not use Primitive's Next.js application provider in Electron.

## Desktop sidebar composition

`layouts/dashboard.tsx` composes `Sidebar*` directly from
`@gorth/primitive/custom/sidebar`; there is no local AppSidebar implementation.
The published AppSidebar/NavMaster currently depend on Next navigation and lack
a native-footer render slot, so they are not mounted in Electron. The app owns
only its navigation data/callbacks. Header controls match SSO's h-14, size-9 icon
and text-2xl branding; the account control belongs in SidebarFooter.

`components/dashboard/nav-user.tsx` uses the local `nav-identity.tsx` adapter
for NavAccount/NavIdentity presentation. Primitive's published dashboard/nav-user
module imports next/link at module scope, even if only its display components
are used. Production tree-shaking can hide that dependency, but Vite development
still evaluates Next and crashes with `process is not defined`. Do not import
that runtime module or add a process/Next router shim in Electron.

The local adapter preserves the shared layout using framework-free Primitive
Avatar, SidebarMenuButton, cn and formatter exports. DashboardMenu still uses
PortalPanel so popups appear above native web contents. Menu items deliberately
use `default/button`: the installed custom button observes size from the main
document, causing ResizeObserver warnings when mounted in a child-window portal.
Portal measurement observes the portal document and defers native resizing.
Tooltip/toast portal providers are retained.

`pnpm test:dashboard` now runs the Vitest native sidebar fixture with a disposable
profile, in both Vite development and production modes. It covers header/footer geometry, collapsed icons, navigation, native
account menu separation, Escape, guest login/register and app logout callbacks.
The superseded standalone dashboard test script/fixtures were removed.

`tests/vitest/primitive-compatibility.test.ts` inspects app-owned runtime imports
and follows the installed Primitive module graph without tree-shaking. Next,
@next and @bprogress/next imports are rejected; type-only contracts are allowed.

Twenty-four overlapping direct dependencies were removed. They can still appear
as transitive dependencies of the shared packages. React/React DOM, Nitro, tRPC,
Drizzle, SQLite and app-specific Electron packages remain directly declared.

Run `pnpm test` for Vitest, including isolated native Electron windows.
Run native tests outside a restricted macOS sandbox. Run the two apps' native
UI suites sequentially: another app's window can steal focus from tab-input tests.
HTTP/OIDC tests use synthetic loopback services, not real credentials.
`test:auth` and `test:rpc` now also use Vitest; unrelated legacy tests remain separate.

The published dependencies currently report peer-range warnings for AI helpers,
React Ranger, and GraphQL. Those are package metadata issues, not desktop test
failures; no app-level override is used to hide them.
