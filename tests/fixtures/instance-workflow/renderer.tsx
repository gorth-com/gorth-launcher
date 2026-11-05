import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@gorth-io/primitive/cores/tanstack/router";
import {
  QueryClient,
  QueryClientProvider,
} from "@gorth-io/primitive/cores/tanstack/query";
import { SidebarProvider } from "@gorth-io/primitive/custom/sidebar";
import {
  createLauncherRouter,
  instanceToolDestination,
} from "@/lib/navigation";
import { useLauncherNavigation } from "@/hooks/use-launcher-navigation";
import { useInstanceSelection } from "@/hooks/use-instance-selection";
import { AuthContext, type useAuth } from "@/hooks/use-auth";
import { TooltipProvider } from "@/providers/tooltip";
import { ToasterProvider } from "@/providers/toaster";
import { Dashboard } from "@/layouts/dashboard";
import { HomePage } from "@/pages/home";
import { LibraryPage } from "@/pages/instances";
import { DownloadsPage } from "@/pages/downloads";
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
const noop = () => {};
function snapshot(id: string) {
  return {
    instanceId: id,
    notes: "Notes for " + id,
    worlds: [],
    servers: [],
    screenshots: [{ name: "shot.png", modifiedAt: 1, size: 1 }],
    logs: [{ name: "latest.log", kind: "log", modifiedAt: 1, size: 1 }],
  };
}
Object.assign(window, {
  electronAPI: {
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
      command: async (command: { action: string; instanceId: string }) => {
        calls.push(command);
        return {
          ok: true,
          data: {
            snapshot: snapshot(command.instanceId),
            content:
              command.action === "screenshot.preview"
                ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ8AAAAASUVORK5CYII="
                : "archived log for " + command.instanceId,
          },
        };
      },
    },
    content: {
      onChanged: () => noop,
      status: async () => ({
        status: { busy: false, message: "", completed: 0, total: 0 },
        curseforgeConfigured: true,
      }),
      inventory: async (id: string) => ({
        ok: true,
        data: { instanceId: id, items: [], worlds: [] },
      }),
      search: async (query: unknown) => {
        calls.push(query);
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

function Fixture() {
  const nav = useLauncherNavigation();
  const [instances, setInstances] = useState(initialInstances);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
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
    exportLog: async () => true,
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
