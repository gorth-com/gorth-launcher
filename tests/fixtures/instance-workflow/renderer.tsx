import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@gorth-com/primitive/cores/tanstack/router";
import {
  QueryClient,
  QueryClientProvider,
} from "@gorth-com/primitive/cores/tanstack/query";
import { SidebarProvider } from "@gorth-com/primitive/custom/sidebar";
import {
  createLauncherRouter,
  instanceToolDestination,
} from "@/lib/navigation";
import { useLauncherNavigation } from "@/hooks/use-launcher-navigation";
import { useInstanceSelection } from "@/hooks/use-instance-selection";
import { AuthContext, type useAuth } from "@/hooks/use-auth";
import { TooltipProvider } from "@/providers/tooltip";
import { ToasterProvider } from "@/providers/toaster";
import { useToastManager } from "@gorth-com/primitive/custom/toast";
import { Dashboard } from "@/layouts/dashboard";
import { HomePage } from "@/pages/home";
import { LibraryPage } from "@/pages/instances";
import { DownloadsPage } from "@/pages/downloads";
import { NotificationsPage } from "@/pages/notifications";
import { useNotifications } from "@/hooks/use-notifications";
import type { ContentStatus } from "@/lib/content/interface";
import { ConsolePage } from "@/pages/console";
import { ContentPage } from "@/pages/content";
import { PackPage } from "@/pages/pack";
import { EditInstancePage } from "@/pages/instances/edit/[uuid]";
import { defaultSettings } from "@/utils/constant";
import { defaultInstanceSettings } from "@/lib/library/instance-settings";
import type { Instance, GameSnapshot } from "@/utils/interface";
import type { useLibrary } from "@/hooks/use-library";
import type { useGame } from "@/hooks/use-game";
import "@/styles/globals.css";

const initialInstances: Instance[] = [
  {
    id: "a",
    name: "Alpha",
    version: "1.20.1",
    loader: "Vanilla",
    createdAt: 1,
  },
  {
    id: "b",
    name: "Beta",
    version: "1.21.1",
    loader: "Fabric",
    loaderVersion: "0.19.3",
    createdAt: 2,
  },
];
const calls: unknown[] = [];
let identifyMods = false;
let modEnabled = true;
const contentListeners = new Set<(status: ContentStatus) => void>();
let holdSearch = false;
let resolveSearch: (() => void) | undefined;
const noop = () => {};
function snapshot(id: string) {
  return {
    instanceId: id,
    notes: "Notes for " + id,
    worlds: [],
    servers: [],
    screenshots: [{ name: "shot.png", modifiedAt: 1, size: 1 }],
    logs: [
      { name: "latest.log", kind: "log", modifiedAt: 1, size: 1 },
      { name: "archived.log.gz", kind: "log", modifiedAt: 1, size: 1 },
      { name: "extra.txt", kind: "log", modifiedAt: 1, size: 1 },
    ],
  };
}
Object.assign(window, {
  electronAPI: {
    game: {
      components: async () => [
        { id: "lwjgl", name: "LWJGL", version: "3.3.1" },
        { id: "minecraft", name: "Minecraft", version: "1.20.1" },
      ],
    },
    windowState: {
      isMacOS: true,
      getIsFullScreen: async () => false,
      onFullScreenChanged: () => noop,
    },
    auth: {
      onViewChanged: () => noop,
      viewState: async () => ({ visible: false, completed: false }),
    },
    instanceData: {
      snapshot: async (id: string) => ({ ok: true, data: snapshot(id) }),
      command: async (command: {
        action: string;
        instanceId: string;
        name?: string;
      }) => {
        calls.push(command);
        return {
          ok: true,
          data: {
            snapshot: snapshot(command.instanceId),
            content:
              command.action === "screenshot.preview"
                ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ8AAAAASUVORK5CYII="
                : "archived log for " +
                  command.instanceId +
                  "\n" +
                  command.name +
                  "\n<unsafe>\n" +
                  "fixture log line\n".repeat(2000),
          },
        };
      },
    },
    content: {
      preparePreview: async () => ({ ok: true, data: null }),
      packOverview: async () => ({
        ok: true,
        data: identifyMods
          ? {
              name: "Master of Cipher",
              currentVersion: "2.0.0",
              source: {
                provider: "curseforge",
                projectId: "1526695",
                versionId: "9418600",
              },
              website: "https://www.curseforge.com/minecraft/modpacks/fixture",
              versions: [
                {
                  id: "next",
                  name: "Master of Cipher-2.1.1.zip",
                  filename: "pack.zip",
                },
              ],
            }
          : null,
      }),
      packChangelog: async () => ({
        ok: true,
        data: {
          text: "<h2>Major Updates</h2><ul><li>Updated mods</li></ul><script>window.unsafeChangelog = true</script>",
          format: "html",
        },
      }),
      onChanged: (callback: (status: ContentStatus) => void) => {
        contentListeners.add(callback);
        return () => {
          contentListeners.delete(callback);
        };
      },
      status: async () => ({
        status: { busy: false, message: "", completed: 0, total: 0 },
        curseforgeConfigured: true,
      }),
      inventory: async (id: string) => ({
        ok: true,
        data: {
          instanceId: id,
          items: identifyMods
            ? [
                {
                  id: "file:mods::renamed.jar",
                  kind: "mod",
                  filename: "renamed.jar",
                  directory: "mods",
                  enabled: modEnabled,
                  managed: false,
                  modified: false,
                  provider: null,
                  projectId: null,
                  versionId: null,
                  checksum: "abc",
                },
              ]
            : [],
          worlds: [],
        },
      }),
      metadata: async (id: string) => ({
        ok: true,
        data: {
          instanceId: id,
          worlds: [],
          items: [
            {
              id: "file:mods::renamed.jar",
              checksum: "abc",
              metadata: {
                provider: "curseforge",
                versionName: "1.2.3",
                project: {
                  id: "123",
                  name: "Identified Fixture Mod",
                  description: "Online description",
                  author: "Fixture author",
                  downloads: 2,
                  url: "https://www.curseforge.com/minecraft/mc-mods/fixture",
                },
              },
            },
          ],
        },
      }),
      manage: async (command: { action: string; instanceId: string }) => {
        calls.push(command);
        modEnabled = command.action !== "disable";
        return window.electronAPI.content.inventory(command.instanceId);
      },
      search: async (query: unknown) => {
        calls.push(query);
        if (holdSearch) {
          holdSearch = false;
          await new Promise<void>((resolve) => {
            resolveSearch = resolve;
          });
        }
        return { ok: true, data: { projects: [], more: false } };
      },
    },
  },
});
const game: GameSnapshot = {
  directory: "/isolated/instances",
  jobs: [
    {
      instanceId: "b",
      version: "1.21.1",
      phase: "running",
      logs: ["[INFO] Beta log <unsafe>"],
      message: "Running",
      completed: 2,
      total: 2,
      speed: 0,
      eta: null,
      queuePosition: null,
    },
  ],
  activeId: "b",
  activeIds: ["b"],
  downloadingId: null,
  queue: [],
  history: [
    {
      id: "session",
      instanceId: "b",
      startedAt: 2,
      endedAt: 5002,
      duration: 5000,
      exitCode: 0,
      crashed: false,
    },
  ],
};
const auth = {
  account: null,
  authenticated: false,
  loading: false,
  busy: false,
  login: noop,
  register: noop,
  logout: noop,
  auth: { accounts: [] },
} as unknown as ReturnType<typeof useAuth>;

function ToastProbe() {
  const { toasts } = useToastManager();
  useEffect(() => {
    Object.assign(window, { fixtureToasts: toasts.map((item) => item.title) });
  }, [toasts]);
  return null;
}
function Fixture() {
  const nav = useLauncherNavigation();
  const [instances, setInstances] = useState(initialInstances);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [notificationJobs, setNotificationJobs] = useState(game.jobs);
  const notifications = useNotifications("", notificationJobs);
  const selection = useInstanceSelection(instances, nav.page);
  useEffect(() => {
    const target = instanceToolDestination(
      nav.page,
      selection.selectedInstanceId,
    );
    if (target)
      nav.navigate(target.page, { section: target.section, replace: true });
  }, [nav.page, selection.selectedInstanceId, nav.navigate]);
  const gaming = {
    game,
    versions: [],
    ready: true,
    error: "",
    refresh: async () => {},
    clearError: noop,
    run: async (command: unknown) => {
      calls.push(command);
      return true;
    },
    openDirectory: async () => {},
    exportLog: async (id: string) => {
      calls.push({ action: "export.log", id });
      return true;
    },
  } as ReturnType<typeof useGame>;
  const library = {
    instances,
    settings: defaultSettings,
    busy: false,
    instanceSettings: Object.fromEntries(
      instances.map((item) => [
        item.id,
        defaultInstanceSettings(defaultSettings),
      ]),
    ),
    run: async () => true,
  } as unknown as ReturnType<typeof useLibrary>;
  const open = (instance: Instance) => {
    selection.onInstanceChange(instance.id);
    nav.navigate(`instances/edit/${instance.id}`);
  };
  Object.assign(window, {
    flow: {
      holdSearch: () => {
        holdSearch = true;
      },
      resolveSearch: () => resolveSearch?.(),
      finishContent: () => {
        for (const listener of contentListeners)
          listener({
            busy: true,
            message: "Đang cài đặt…",
            completed: 0,
            total: 1,
          });
        for (const listener of contentListeners)
          listener({
            busy: false,
            message: "Đã cài đặt. Mở Thư viện để tải/chạy game.",
            completed: 1,
            total: 1,
          });
      },
      failNotification: () =>
        setNotificationJobs(
          game.jobs.map((job) => ({
            ...job,
            phase: "error",
            message: "Fixture failure",
          })),
        ),
      enableModMetadata: () => {
        identifyMods = true;
        game.activeId = null;
        game.activeIds = [];
      },
      page: nav.page,
      selected: selection.selectedInstanceId,
      calls,
      navigate: nav.navigate,
      select: selection.onInstanceChange,
      remove: (id: string) =>
        setInstances((items) => items.filter((item) => item.id !== id)),
    },
  });
  return (
    <AuthContext.Provider value={auth}>
      <TooltipProvider>
        <ToasterProvider>
          <ToastProbe />
          <nav data-test-toolbar>
            {(
              [
                "home",
                "instances",
                "downloads",
                "console",
                "mods",
                "pack",
                "gallery",
                "instances/data",
              ] as const
            ).map((page) => (
              <button
                key={page}
                data-test-nav={page}
                onClick={() => nav.navigate(page)}
              >
                {page}
              </button>
            ))}
            <button
              data-test-edit
              onClick={() => {
                const item = instances.find(
                  (entry) => entry.id === selection.selectedInstanceId,
                );
                if (item) open(item);
              }}
            >
              Edit selected
            </button>
          </nav>
          {nav.page.startsWith("instances/edit/") ? (
            <EditInstancePage
              key={nav.page + nav.editSection}
              id={nav.page.slice("instances/edit/".length)}
              initialSection={nav.editSection}
              settings={defaultSettings}
              navigation={{ onBack: nav.back }}
              onBack={nav.back}
              onNavigate={nav.navigate}
              library={library}
              gaming={gaming}
              authentication={auth}
              onBrowseContent={nav.navigate}
            />
          ) : (
            <SidebarProvider>
              <Dashboard
                instanceCount={instances.length}
                unreadCount={3}
                page={nav.page}
                onNavigate={nav.navigate}
              />
              <main className="min-w-0 flex-1 p-6" data-page={nav.page}>
                {nav.page === "home" && (
                  <HomePage
                    instances={instances}
                    game={game}
                    accounts={[]}
                    accountId={null}
                    onCreate={noop}
                    onOpenLibrary={() => nav.navigate("instances")}
                    onSelect={open}
                    onPlay={noop}
                    onStop={noop}
                    onAccount={noop}
                    {...selection}
                  />
                )}
                {nav.page === "instances" && (
                  <LibraryPage
                    instances={instances}
                    query={query}
                    filter={filter}
                    onQueryChange={setQuery}
                    onFilterChange={setFilter}
                    onCreate={noop}
                    onSelect={open}
                    onPlay={(instance) =>
                      void gaming.run({ action: "play", instance })
                    }
                    statusLabel={() => "Ready"}
                  />
                )}
                {nav.page === "pack" && (
                  <PackPage
                    {...selection}
                    instances={instances}
                    gameBusy={false}
                    onLibrary={() => nav.navigate("instances")}
                    hideWebview
                    onDetailChange={noop}
                  />
                )}
                {nav.page === "downloads" && (
                  <DownloadsPage
                    {...gaming}
                    instances={instances}
                    onHistory={() => nav.navigate("settings/history")}
                    onConsole={(id) => {
                      selection.onInstanceChange(id);
                      nav.navigate("console");
                    }}
                  />
                )}
                {nav.page === "console" && (
                  <ConsolePage
                    {...gaming}
                    instances={instances}
                    {...selection}
                  />
                )}
                {nav.page === "notifications" && (
                  <NotificationsPage {...notifications} />
                )}
                {nav.page === "mods" && (
                  <ContentPage
                    instances={instances}
                    fixedKind="mod"
                    gameBusy={false}
                    onLibrary={() => nav.navigate("instances")}
                    hideWebview={false}
                    onDetailChange={noop}
                    {...selection}
                  />
                )}
                {nav.page === "settings/history" && (
                  <div data-history>History destination</div>
                )}
              </main>
            </SidebarProvider>
          )}
        </ToasterProvider>
      </TooltipProvider>
    </AuthContext.Provider>
  );
}
const router = createLauncherRouter(Fixture);
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
