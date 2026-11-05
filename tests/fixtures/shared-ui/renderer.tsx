import { CreateInstancePage } from "@/pages/instances/create";
import { QueryClient, QueryClientProvider } from "@gorth-io/primitive/cores/tanstack/query";
import { EditInstancePage } from "@/pages/instances/edit/[uuid]";
import { InstanceDataPage } from "@/pages/instances/data";
import type { useLibrary } from "@/hooks/use-library";
import type { useGame } from "@/hooks/use-game";
import { defaultInstanceSettings } from "@/lib/library/instance-settings";
import { ConfirmationProvider } from "@/providers/confirmation";
import { RouterProvider } from "@gorth-io/primitive/cores/tanstack/router";
import { createLauncherRouter } from "@/lib/navigation";
import { confirmAction } from "@/lib/confirmation";
import { useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { PageHeading } from "@/components/heading";
import { Settings } from "@gorth-io/primitive/cores/lucide";
import { SidebarProvider } from "@gorth-io/primitive/custom/sidebar";
import { Button } from "@gorth-io/primitive/custom/button";
import { Dashboard } from "@/layouts/dashboard";
import { SettingsLayout } from "@/layouts/settings";
import { SettingsPage } from "@/pages/settings";
import { ToasterProvider } from "@/providers/toaster";
import type { Theme } from "@/lib/theme";
import { defaultSettings } from "@/utils/constant";
import { AuthContext, useAuth } from "@/hooks/use-auth";
import { PortalProvider } from "@/providers/portal";
import { TooltipProvider } from "@/providers/tooltip";
import "@/styles/globals.css";
const calls: string[] = [];
const created: unknown[] = [];
const dataIds: string[] = [];
const fixtureInstance = {
  id: "6f60ed3d-84f9-4dd2-b77a-c3f037d0306e",
  name: "Fixture instance",
  version: "1.20.1",
  loader: "Vanilla",
  createdAt: 1,
};
Object.assign(window, { instanceFixture: { created, dataIds } });

Object.assign(window, {
  confirmFixture: () => {
    void confirmAction({
      title: "Delete fixture account?",
      destructive: true,
    }).then((answer) => calls.push(`confirm:${answer}`));
  },
});
Object.assign(window, {
  electronAPI: {
    settings: {
      javaInstallations: async () => [],
      chooseJava: async () => "/fixture/java/bin/java",
      testJava: async () => ({ path: "/fixture/java/bin/java", major: 17, version: "17.0.1", vendor: "Fixture", architecture: "aarch64" }),
      openFolder: async () => {},
      chooseTool: async () => "/fixture/tools/editor",
      checkTool: async () => true,
    },
    networkProxy: {
      get: async () => ({ mode: "system", host: "", port: 8080, hasCredentials: false }),
      save: async (input: { settings: object }) => ({ ...input.settings, hasCredentials: false }),
      route: async () => "DIRECT",
    },
    auth: {
      onViewChanged: () => () => {},
      viewState: async () => ({ visible: false, completed: false }),
    },
    instanceData: {
      snapshot: async (id: string) => {
        dataIds.push(id);
        return {
          ok: true,
          data: {
            instanceId: id,
            notes: "Fixture notes",
            worlds: [],
            servers: [],
            screenshots: [],
            logs: [],
          },
        };
      },
    },
    windowState: {
      isMacOS: true,
      getIsFullScreen: async () => false,
      onFullScreenChanged: () => () => {},
    },
    portal: {
      update: () => {},
      onBlur: () => () => {},
    },
  },
});
function Fixture() {
  const [workspace, setWorkspace] = useState("");
  Object.assign(window, { openWorkspace: setWorkspace });
  const [settings, setSettings] = useState(false);
  const [preferences, setPreferences] = useState(defaultSettings);
  Object.assign(window, { fixturePreferences: preferences });
  const [theme, setTheme] = useState<Theme>("system");
  const [open, setOpen] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [page, setPage] = useState<"home" | "accounts">("home");
  const account = authenticated
    ? {
        name: "Desktop Fixture Long Account Name",
        email: "fixture@example.test",
      }
    : null;
  const auth = {
    account,
    authenticated,
    loading: false,
    busy: false,
    login: () => calls.push("login"),
    register: () => calls.push("register"),
    logout: () => {
      calls.push("logout");
      setAuthenticated(false);
    },
  } as unknown as ReturnType<typeof useAuth>;
  Object.assign(window, { sidebarFixture: { calls } });
  const workspaceProps = {
    settings: preferences,
    navigation: { onBack: () => setWorkspace(""), canGoBack: true },
    onBack: () => setWorkspace(""),
    onNavigate: () => setWorkspace(""),
  };
  const libraryMock = {
    instances: [fixtureInstance],
    instanceSettings: {
      [fixtureInstance.id]: defaultInstanceSettings(defaultSettings),
    },
    busy: false,
    run: async () => true,
  } as unknown as ReturnType<typeof useLibrary>;
  const gameMock = {
    game: { jobs: [], activeId: null },
    versions: [
      { id: "1.20.1", type: "release" },
      { id: "1.21.1", type: "release" },
    ],
    run: async () => true,
    openDirectory: async () => {},
    exportLog: async () => true,
  } as unknown as ReturnType<typeof useGame>;
  return (
    <AuthContext.Provider value={auth}>
      <TooltipProvider>
        <PortalProvider>
          <ConfirmationProvider>
            <ToasterProvider>
              {workspace === "create" ? (
                <CreateInstancePage
                  {...workspaceProps}
                  versions={gameMock.versions}
                  instances={[]}
                  busy={false}
                  onCreate={async (value) => {
                    created.push(value);
                    return true;
                  }}
                  onRefreshVersions={() => {}}
                />
              ) : workspace === "edit" ? (
                <EditInstancePage
                  {...workspaceProps}
                  id={fixtureInstance.id}
                  library={libraryMock}
                  gaming={gameMock}
                  authentication={
                    {
                      ...auth,
                      auth: { accounts: [], selectedAccountId: null },
                    } as unknown as ReturnType<typeof useAuth>
                  }
                />
              ) : workspace === "data" ? (
                <InstanceDataPage
                  instances={[fixtureInstance]}
                  busy={false}
                  onChanged={() => {}}
                />
              ) : settings ? (
                <SettingsLayout
                  settings={preferences}
                  navigation={{ onBack: () => {}, canGoBack: true }}
                  onNavigate={() => {}}
                  onMain={() => {
                    calls.push("main-return:" + page);
                    setSettings(false);
                  }}
                  instanceCount={3}
                  unreadCount={2}
                >
                  {(section) => (
                    <div data-settings-section={section}>
                      <SettingsPage
                        section={section}
                        settings={preferences}
                        setSettings={setPreferences}
                        theme={theme}
                        setTheme={setTheme}
                        info={null}
                        setNotice={() => {}}
                      />
                    </div>
                  )}
                </SettingsLayout>
              ) : (
                <SidebarProvider
                  open={open}
                  onOpenChange={setOpen}
                  className="h-screen min-h-0"
                  style={{ "--sidebar-width-icon": "3.5rem" } as CSSProperties}
                >
                  <Dashboard
                    compact
                    instanceCount={3}
                    unreadCount={2}
                    onNavigate={(value) => {
                      calls.push(value);
                      setPage(value as typeof page);
                    }}
                    collapsible
                    collapseMode="icon"
                    page={page}
                  />
                  <main
                    data-fixture-page={page}
                    className="flex-1 bg-background p-6 text-foreground"
                  >
                    <div data-heading-fixture>
                      <PageHeading title="Heading fixture" icon={Settings} />
                    </div>
                    <Button onClick={() => setOpen((value) => !value)}>
                      Toggle sidebar
                    </Button>
                    <Button onClick={() => setSettings(true)}>
                      Open Settings
                    </Button>
                  </main>
                </SidebarProvider>
              )}
            </ToasterProvider>
          </ConfirmationProvider>
        </PortalProvider>
      </TooltipProvider>
    </AuthContext.Provider>
  );
}
const router = createLauncherRouter(Fixture);
Object.assign(window, {
  navigateRoute: (path: string) => router.navigate({ to: path }),
  routePath: () => router.state.location.pathname,
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>,
);
