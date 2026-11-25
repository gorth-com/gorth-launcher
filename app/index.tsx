import { CreateInstancePage } from "@/pages/instances/create";
import { EditInstancePage } from "@/pages/instances/edit/[uuid]";
import { useInstanceSelection } from "@/hooks/use-instance-selection";
import { instanceToolDestination } from "@/lib/navigation";
import { confirmAction } from "@/lib/confirmation";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { ContentPage } from "@/pages/content";
import { PackPage } from "@/pages/pack";
import { ConsolePage } from "@/pages/console";
import { NotificationsPage } from "@/pages/notifications";
import { useNotifications } from "@/hooks/use-notifications";
import { ShortcutsPage } from "@/pages/settings/shortcuts";
import { useEffect, useRef, useState } from "react";
import { Dashboard } from "@/layouts/dashboard";
import { SettingsLayout } from "@/layouts/settings";

import { Button } from "@gorth-com/primitive/custom/button";
import { useLibrary } from "@/hooks/use-library";
import { LoadingScreen } from "@/components/element/loading-screen";
import { notifyApplicationReady } from "@/utils/application-ready";
import { SidebarProvider } from "@gorth-com/primitive/custom/sidebar";
import {
  AccountsPage,
  DownloadsPage,
  HomePage,
  LibraryPage,
  SettingsPage,
} from "@/pages";
import { useGame } from "@/hooks/use-game";
import { useAuth } from "@/hooks/use-auth";
import { AuthScreen } from "@/components/element/auth-screen";
import { Titlebar } from "@/layouts/title-bar";
import {
  NavigationBar,
  type NavigationBarProps,
} from "@/layouts/navigation-bar";
import { useLauncherNavigation } from "@/hooks/use-launcher-navigation";
import { useJavaSetup } from "@/hooks/use-java-setup";
import {
  effectiveGameSettings,
  minecraftPreferences,
} from "@/lib/library/game-preferences";
import { formatPlayTime } from "@/utils/formatter";
import { Wrapper } from "@/layouts/wrapper";
import { type Instance, type Page } from "@/utils/interface";
import { gamePhaseLabels } from "@/utils/constant";
import {
  applyTheme,
  readTheme,
  subscribeToSystemTheme,
  type Theme,
} from "@/lib/theme";
import type { LauncherInfo } from "@/preload/interface";

export default function Application() {
  const authentication = useAuth();
  const gaming = useGame();
  const pageNavigation = useLauncherNavigation();
  const { page, navigate: setPage } = pageNavigation;
  const lastMainPage = useRef<Page>("home");
  useEffect(() => {
    if (
      !page.startsWith("instances/") &&
      page !== "settings" &&
      !page.startsWith("settings/") &&
      page !== "shortcuts" &&
      page !== "gallery" &&
      page !== "library" &&
      page !== "instance-data" &&
      !["content", "mods", "resourcepacks", "shaders"].includes(page)
    )
      lastMainPage.current = page;
  }, [page]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [packKind, setPackKind] = useState<"mod" | "resourcepack" | "shader">(
    "mod",
  );
  const library = useLibrary();
  const { instances, settings, setSettings } = library;
  const selection = useInstanceSelection(instances, page);
  useEffect(() => {
    if (!library.ready) return;
    const target = instanceToolDestination(page, selection.selectedInstanceId);
    if (target)
      setPage(target.page, { section: target.section, replace: true });
  }, [library.ready, page, selection.selectedInstanceId, setPage]);
  useJavaSetup(library.ready, settings, () => setPage("settings/runtime"));
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [info, setInfo] = useState<LauncherInfo | null>(null);
  const [infoReady, setInfoReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const openInstance = (instance: Instance) => {
    selection.onInstanceChange(instance.id);
    setPage(`instances/edit/${instance.id}`);
  };
  const openConsole = (id: string) => {
    selection.onInstanceChange(id);
    setPage(`instances/edit/${id}`, { section: "console" });
  };
  useEffect(
    () =>
      window.electronAPI.game.onOpenConsole((id) => {
        selection.onInstanceChange(id);
        setPage(`instances/edit/${id}`, { section: "console" });
      }),
    [selection.onInstanceChange, setPage],
  );
  const [notice, setNotice] = useState("");
  useFeedbackToast(notice);
  useFeedbackToast(gaming.error);
  useFeedbackToast(library.error);
  useFeedbackToast(authentication.error);
  useFeedbackToast(authentication.auth?.gameWarning, "warning");
  const notifications = useNotifications(
    notice.startsWith("Đã ") ? notice : "",
    gaming.game.jobs,
  );
  const [contentDetail, setContentDetail] = useState(false);
  const [shortcutTarget, setShortcutTarget] = useState<string | null>(null);
  useEffect(() => {
    applyTheme(theme);
    return subscribeToSystemTheme(() => applyTheme(theme));
  }, [theme]);
  useEffect(
    () =>
      window.electronAPI.appMenu.onAction((action) => {
        if (action === "new-instance") {
          setPage("instances/create");
        } else {
          setPage(action);
        }
      }),
    [],
  );
  useEffect(() => {
    const onMenuAction = (event: Event) => {
      const action = (event as CustomEvent<Page | "new-instance">).detail;

      if (action === "new-instance") {
        setPage("instances/create");
      } else {
        setPage(action);
      }
    };
    window.addEventListener("launcher:menu-action", onMenuAction);
    return () =>
      window.removeEventListener("launcher:menu-action", onMenuAction);
  }, []);
  useEffect(
    () => window.electronAPI.library.onShortcutPlay(setShortcutTarget),
    [],
  );
  useEffect(() => {
    if (!shortcutTarget || !library.ready || !gaming.ready) return;
    const instance = instances.find((item) => item.id === shortcutTarget);
    setShortcutTarget(null);
    if (!instance) setNotice("Shortcut trỏ tới instance không còn tồn tại.");
    else {
      selection.onInstanceChange(instance.id);
      void gaming.run({ action: "play", instance });
    }
  }, [shortcutTarget, library.ready, gaming.ready, instances]);
  useEffect(() => {
    let active = true;
    window.electronAPI.launcher
      .getInfo()
      .then((value) => {
        if (active) setInfo(value);
      })
      .catch(() => {
        if (active) setNotice("Không đọc được thông tin hệ thống.");
      })
      .finally(() => {
        if (active) setInfoReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const statusLabel = (id: string) =>
    gamePhaseLabels[
      gaming.game.jobs.find(
        (job: { instanceId: string | undefined }) => job.instanceId === id,
      )?.phase ?? "idle"
    ];
  const interfaceReady =
    library.ready && authentication.ready && gaming.ready && infoReady;
  useEffect(() => {
    if (!interfaceReady) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(notifyApplicationReady);
    });
    return () => cancelAnimationFrame(frame);
  }, [interfaceReady]);
  if (!interfaceReady) {
    return <LoadingScreen error={!library.ready ? library.error : undefined} />;
  }

  const compact = library.settings.tabLayout === "compact";
  const navigationProps: NavigationBarProps = {
    sidebarOpen,
    onToggleSidebar:
      library.settings.sidebarCollapsible === false
        ? undefined
        : () => setSidebarOpen((open) => !open),
    canGoBack: pageNavigation.canGoBack,
    canGoForward: pageNavigation.canGoForward,
    onBack: () => {
      setContentDetail(false);
      pageNavigation.back();
    },
    onForward: () => {
      setContentDetail(false);
      pageNavigation.forward();
    },
  };
  const workspaceProps = {
    settings,
    navigation: navigationProps,
    onNavigate: setPage,
    onBack: () =>
      pageNavigation.canGoBack ? pageNavigation.back() : setPage("instances"),
  };
  if (page === "instances/create")
    return (
      <CreateInstancePage
        {...workspaceProps}
        versions={gaming.versions}
        instances={instances}
        busy={library.busy || !!gaming.game.activeId}
        onRefreshVersions={() => void gaming.refresh()}
        onCreate={async (command) => {
          if (!(await library.run(command))) return false;
          setQuery("");
          setFilter("all");
          setPage("instances");
          setNotice("Đã tạo instance.");
          return true;
        }}
      />
    );
  if (page.startsWith("instances/edit/"))
    return (
      <EditInstancePage
        key={page + (pageNavigation.editSection ?? "")}
        {...workspaceProps}
        id={page.slice("instances/edit/".length)}
        library={library}
        gaming={gaming}
        authentication={authentication}
        initialSection={pageNavigation.editSection}
        onSectionChange={(section) =>
          setPage(page as `instances/edit/${string}`, {
            section,
            replace: true,
          })
        }
        onInstanceChange={(id, section) => {
          selection.onInstanceChange(id);
          setPage(`instances/edit/${id}`, { section });
        }}
        onBrowseContent={(target) => {
          selection.onInstanceChange(page.slice("instances/edit/".length));
          setPackKind(
            target === "mods"
              ? "mod"
              : target === "shaders"
                ? "shader"
                : "resourcepack",
          );
          setPage("pack");
        }}
      />
    );
  if (
    page === "settings" ||
    page.startsWith("settings/") ||
    page === "shortcuts" ||
    ["content", "mods", "resourcepacks", "shaders"].includes(page)
  )
    return (
      <>
        <SettingsLayout
          section={
            ["content", "mods", "resourcepacks", "shaders"].includes(page)
              ? "about"
              : page === "shortcuts"
                ? "shortcuts"
                : page === "settings/account"
                  ? "profile"
                  : page === "settings/help"
                    ? "about"
                    : page.startsWith("settings/")
                      ? (page.slice(
                          9,
                        ) as import("@/utils/constant").LauncherSettingsSection)
                      : "general"
          }
          settings={settings}
          navigation={navigationProps}
          onNavigate={setPage}
          onMain={() => setPage(lastMainPage.current)}
          instanceCount={instances.length}
          unreadCount={notifications.unread}
        >
          {(section) =>
            ["content", "mods", "resourcepacks", "shaders"].includes(page) ? (
              <ContentPage
                {...selection}
                key={page}
                fixedKind={
                  page === "content"
                    ? undefined
                    : page === "mods"
                      ? "mod"
                      : page === "shaders"
                        ? "shader"
                        : "resourcepack"
                }
                instances={instances}
                gameBusy={!!gaming.game.activeId}
                onLibrary={() => setPage("instances")}
                hideWebview={false}
                onDetailChange={setContentDetail}
              />
            ) : section === "shortcuts" ? (
              <ShortcutsPage />
            ) : (
              <SettingsPage
                section={section}
                settings={settings}
                setSettings={setSettings}
                theme={theme}
                setTheme={setTheme}
                info={info}
                setNotice={setNotice}
                onNavigate={setPage}
                history={gaming.game.history}
              />
            )
          }
        </SettingsLayout>
        <AuthScreen
          compact={compact}
          showLogo={settings.showTitlebarLogo ?? true}
          onReturn={() => {
            setPage("accounts");

            setContentDetail(false);
          }}
        />
      </>
    );
  return (
    <>
      <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <Titlebar
          showLogo={library.settings.showTitlebarLogo ?? true}
          navigation={compact ? navigationProps : undefined}
        />
        {!compact && <NavigationBar {...navigationProps} />}
        <SidebarProvider
          style={{ "--sidebar-width-icon": "3.5rem" } as React.CSSProperties}
          open={library.settings.sidebarCollapsible === false || sidebarOpen}
          onOpenChange={setSidebarOpen}
          className="min-h-0 flex-1 overflow-hidden"
        >
          <Dashboard
            profileName={settings.profileName}
            profileIcon={settings.profileIcon}
            collapsible={library.settings.sidebarCollapsible ?? true}
            collapseMode={library.settings.sidebarCollapseMode ?? "none"}
            compact={compact}
            page={page}
            onNavigate={setPage}
            instanceCount={instances.length}
            unreadCount={notifications.unread}
          />
          <main
            className={`min-w-0 flex-1 ${contentDetail || page === "console" ? "overflow-hidden" : "overflow-y-auto"}`}
          >
            <Wrapper
              fullWidth={contentDetail}
              immersive={contentDetail}
              fill={page === "console"}
            >
              {!library.ready && <p role="status">{"Đang mở thư viện…"}</p>}
              <fieldset
                disabled={!library.ready || library.busy}
                className={`min-w-0 border-0 p-0 ${contentDetail ? "h-full" : page === "console" ? "flex min-h-0 flex-1 flex-col" : ""}`}
              >
                {(page === "accounts" || page === "account") && (
                  <AccountsPage {...authentication} />
                )}
                {page === "home" && (
                  <HomePage
                    {...selection}
                    game={gaming.game}
                    accounts={authentication.auth?.accounts ?? []}
                    accountId={authentication.auth?.selectedAccountId ?? null}
                    onAccount={(id) =>
                      void authentication.run({ action: "game.select", id })
                    }
                    onPlay={(instance) =>
                      void gaming.run({ action: "play", instance })
                    }
                    onStop={(id) => void gaming.run({ action: "stop", id })}
                    instances={instances}
                    onCreate={() => setPage("instances/create")}
                    onOpenLibrary={() => setPage("instances")}
                    onSelect={openInstance}
                  />
                )}
                {page === "instances" && (
                  <>
                    <LibraryPage
                      onPlay={(instance) => {
                        selection.onInstanceChange(instance.id);
                        void gaming.run({ action: "play", instance });
                      }}
                      playDisabled={(id) =>
                        gaming.game.activeIds.includes(id) ||
                        gaming.game.queue.includes(id)
                      }
                      importDisabled={library.busy || !!gaming.game.activeId}
                      onImportOrphans={() =>
                        void library.run({ action: "orphans.import" })
                      }
                      playTimeLabel={(id) => {
                        const stored = library.instanceSettings[id];
                        const preferences = stored
                          ? effectiveGameSettings(settings, stored)
                              .minecraftOptions!
                          : minecraftPreferences(settings);
                        return preferences.showGameTime
                          ? formatPlayTime(
                              gaming.game.history
                                .filter((entry) => entry.instanceId === id)
                                .reduce(
                                  (sum, entry) => sum + entry.duration,
                                  0,
                                ),
                              preferences.durationsInHours,
                            )
                          : undefined;
                      }}
                      instances={[...instances].sort((a, b) => {
                        if (settings.instanceSort === "last-played") {
                          const lastPlayed = (id: string) =>
                            Math.max(
                              0,
                              ...gaming.game.history
                                .filter((entry) => entry.instanceId === id)
                                .map((entry) => entry.startedAt),
                            );
                          return (
                            lastPlayed(b.id) - lastPlayed(a.id) ||
                            a.name.localeCompare(b.name)
                          );
                        }
                        return a.name.localeCompare(b.name);
                      })}
                      query={query}
                      onQueryChange={setQuery}
                      filter={filter}
                      onFilterChange={setFilter}
                      onCreate={() => setPage("instances/create")}
                      onSelect={openInstance}
                      statusLabel={statusLabel}
                    />
                  </>
                )}
                {page === "downloads" && (
                  <DownloadsPage
                    {...gaming}
                    instances={instances}
                    onConsole={openConsole}
                    onHistory={() => setPage("settings/history")}
                  />
                )}
                {page === "console" && (
                  <ConsolePage
                    {...gaming}
                    instances={instances}
                    {...selection}
                  />
                )}
                {page === "notifications" && (
                  <NotificationsPage {...notifications} />
                )}
                {page === "modpacks" && (
                  <ContentPage
                    {...selection}
                    key={page}
                    fixedKind="modpack"
                    initialProvider="curseforge"
                    instances={instances}
                    gameBusy={!!gaming.game.activeId}
                    onLibrary={() => setPage("instances")}
                    hideWebview={false}
                    onDetailChange={setContentDetail}
                  />
                )}
                {page === "pack" && (
                  <PackPage
                    initialKind={packKind}
                    {...selection}
                    instances={instances}
                    gameBusy={!!gaming.game.activeId}
                    onLibrary={() => setPage("instances")}
                    hideWebview={false}
                    onDetailChange={setContentDetail}
                  />
                )}
                {page === "instances" && library.trash.length > 0 && (
                  <section className="mt-6 space-y-3 rounded-lg border p-4">
                    <h2 className="font-medium">
                      Thùng rác ({library.trash.length})
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Instance được tự dọn theo thời hạn trong Cài đặt.
                    </p>
                    <Button
                      className="h-9"
                      variant="outline"
                      disabled={library.busy || !!gaming.game.activeId}
                      onClick={() =>
                        void library.run({ action: "trash.cleanup" })
                      }
                    >
                      Dọn toàn bộ Trash
                    </Button>
                    {library.trash.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-sm">
                          {item.name} · {item.version}
                        </span>
                        <Button
                          className="h-9"
                          variant="outline"
                          disabled={!!gaming.game.activeId}
                          onClick={() =>
                            void library.run({ action: "restore", id: item.id })
                          }
                        >
                          Khôi phục
                        </Button>
                        <Button
                          className="h-9"
                          variant="outline"
                          disabled={!!gaming.game.activeId}
                          onClick={() =>
                            void library.run({
                              action: "trash.purge",
                              id: item.id,
                              keepSaves: true,
                            })
                          }
                        >
                          Giữ saves & xóa
                        </Button>
                        <Button
                          className="h-9"
                          variant="destructive"
                          disabled={!!gaming.game.activeId}
                          onClick={async () => {
                            if (
                              await confirmAction(
                                "Xóa vĩnh viễn instance và toàn bộ saves?",
                              )
                            )
                              void library.run({
                                action: "trash.purge",
                                id: item.id,
                                keepSaves: false,
                              });
                          }}
                        >
                          Xóa vĩnh viễn
                        </Button>
                      </div>
                    ))}
                  </section>
                )}
              </fieldset>
            </Wrapper>
          </main>
        </SidebarProvider>
      </div>
      <AuthScreen
        compact={compact}
        showLogo={library.settings.showTitlebarLogo ?? true}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onReturn={() => {
          setPage("accounts");

          setContentDetail(false);
        }}
      />
    </>
  );
}
