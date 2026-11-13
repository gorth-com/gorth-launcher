import { Fragment } from "react";
import { StartupSettings } from "@/components/element/startup-settings";
import { FoldersCard } from "@/components/element/folders-card";
import { JavaSettings } from "./java";
import { MinecraftSettings } from "./minecraft";
import { minecraftPreferences } from "@/lib/library/game-preferences";
import { formatPlayTime } from "@/utils/formatter";
import { ProxySettingsCard } from "@/components/element/proxy-settings";
import {
  GeneralSettings,
  LanguageSettings,
  ServicesSettings,
  ToolsSettings,
} from "./additional";
import { Separator } from "@gorth-io/primitive/default/separator";
import { launcherSettingsSections } from "@/utils/constant";
import { type LauncherSettingsSection } from "@/utils/constant";
import { AppUpdateCard } from "@/components/element/app-update-card";
import type { Page } from "@/utils/interface";
import { PageHeading } from "@/components/heading";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
import {
  RadioGroup,
  RadioGroupItem,
} from "@gorth-io/primitive/default/radio-group";
import { LauncherFooter } from "@/components/element/launcher-footer";
import { type Dispatch, type SetStateAction } from "react";
import { ToastSettings } from "@/components/element/toast-settings";
import { SidebarSettings } from "@/components/element/sidebar-settings";
import { LoginBrowserSettings } from "@/components/element/login-browser-settings";
import { AccountCard } from "@/components/element/account-card";
import { ProfilePreferences } from "@/components/element/profile-preferences";
import { Box, Monitor, Moon, Sun } from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import { Input } from "@gorth-io/primitive/default/input";
import { Switch } from "@gorth-io/primitive/default/switch";
import { type Settings, type PlaySession } from "@/utils/interface";
import { LaunchHistory } from "./history";

import { saveTheme, type Theme } from "@/lib/theme";
import type { LauncherInfo } from "@/preload/interface";
interface SettingsPageProps {
  onNavigate?: (page: Page) => void;
  section?: LauncherSettingsSection;
  history?: PlaySession[];
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
  info: LauncherInfo | null;
  setNotice: (message: string) => void;
}
export function SettingsPage({
  onNavigate,
  section = "general",
  settings,
  setSettings,
  theme,
  setTheme,
  info,
  setNotice,
  history = [],
}: SettingsPageProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeading
        icon={
          launcherSettingsSections.find((item) => item.id === section)?.icon
        }
        title={
          {
            general: "General",
            folders: "Folders",
            language: "Language",
            services: "Services",
            tools: "Tools",
            proxy: "Proxy",
            content: "Content",
            shortcuts: "Shortcuts",
            instance: "Minecraft",
            appearance: "Appearance",
            profile: "Gorth profile",
            runtime: "Java",
            trash: "Trash",
            history: "Launch History",
            about: "About",
          }[section]
        }
      />
      {section === "proxy" && <ProxySettingsCard />}
      {section === "folders" && <FoldersCard />}
      {section === "general" && (
        <>
          <StartupSettings settings={settings} setSettings={setSettings} />
          <GeneralSettings settings={settings} setSettings={setSettings} />
        </>
      )}
      {section === "language" && (
        <LanguageSettings settings={settings} setSettings={setSettings} />
      )}
      {section === "services" && <ServicesSettings onNavigate={onNavigate} />}
      {section === "tools" && (
        <ToolsSettings settings={settings} setSettings={setSettings} />
      )}
      {section === "profile" && (
        <>
          <AccountCard profileName={settings.profileName}>
            <ProfilePreferences settings={settings} setSettings={setSettings} />
          </AccountCard>
          <LoginBrowserSettings />
        </>
      )}
      {section === "content" && (
        <Card className="gap-0 overflow-hidden py-0">
          {(["mods", "modpacks", "resourcepacks", "shaders"] as const).map(
            (page) => (
              <Fragment key={page}>
                <Separator className="first:hidden" />
                <div className="flex items-center justify-between gap-4 p-4">
                  <CardTitle>
                    {
                      {
                        mods: "Mods",
                        modpacks: "Modpacks",
                        resourcepacks: "Resource Packs",
                        shaders: "Shaders",
                      }[page]
                    }
                  </CardTitle>
                  <Button variant="outline" onClick={() => onNavigate?.(page)}>
                    Mở thư viện
                  </Button>
                </div>
              </Fragment>
            ),
          )}
        </Card>
      )}
      {section === "about" && <AppUpdateCard />}
      {section === "appearance" && (
        <Card className="gap-0 overflow-hidden py-0">
          <>
            <Separator className="first:hidden" />
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex flex-col gap-1">
                <CardTitle id="titlebar-logo-label">
                  Logo trên titlebar
                </CardTitle>
                <CardDescription>
                  Hiển thị icon launcher trên thanh tiêu đề.
                </CardDescription>
              </div>
              <Switch
                id="titlebar-logo"
                aria-labelledby="titlebar-logo-label"
                checked={settings.showTitlebarLogo ?? true}
                onCheckedChange={(showTitlebarLogo) =>
                  setSettings({ ...settings, showTitlebarLogo })
                }
              />
            </div>
          </>
          <>
            <Separator className="first:hidden" />
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Chủ đề</CardTitle>
                <CardDescription>
                  Chọn giao diện phù hợp với bạn.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {(
                  [
                    { value: "light", label: "Sáng", icon: Sun },
                    { value: "dark", label: "Tối", icon: Moon },
                    {
                      value: "system",
                      label: "Hệ thống",
                      icon: Monitor,
                    },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant={theme === value ? "default" : "outline"}
                    className="h-9"
                    aria-pressed={theme === value}
                    onClick={() => {
                      try {
                        saveTheme(value);
                        setTheme(value);
                      } catch {
                        setNotice("Không thể lưu chủ đề.");
                      }
                    }}
                  >
                    <Icon size={17} />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </>
          <>
            <Separator />
            <section className="flex flex-col gap-4 p-4">
              <ToastSettings />
            </section>
          </>
          <>
            <Separator />
            <section className="flex flex-col gap-4 p-4">
              <SidebarSettings
                enabled={settings.sidebarCollapsible ?? true}
                mode={settings.sidebarCollapseMode ?? "none"}
                onEnabledChange={(sidebarCollapsible) =>
                  setSettings({ ...settings, sidebarCollapsible })
                }
                onModeChange={(sidebarCollapseMode) =>
                  setSettings({ ...settings, sidebarCollapseMode })
                }
              />
            </section>
          </>
          <>
            <Separator />
            <section className="flex flex-col gap-6 p-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Tab layout</CardTitle>
                <CardDescription>
                  Compact combines navigation with the title bar.
                </CardDescription>
              </div>
              <RadioGroup
                aria-label="Tab layout"
                value={settings.tabLayout ?? "separate"}
                className="flex flex-col gap-4"
                onValueChange={(tabLayout) => {
                  if (tabLayout === "separate" || tabLayout === "compact")
                    setSettings({ ...settings, tabLayout });
                }}
              >
                {(["separate", "compact"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex items-center gap-3 text-sm"
                  >
                    <RadioGroupItem value={value} />
                    {value === "separate" ? "Separate" : "Compact"}
                  </label>
                ))}
              </RadioGroup>
            </section>
          </>
        </Card>
      )}
      {section === "trash" && (
        <Card className="gap-0 overflow-hidden py-0">
          <>
            <Separator className="first:hidden" />
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Thời gian lưu</CardTitle>
                <CardDescription>
                  0 ngày để tắt tự động dọn, tối đa 365 ngày.
                </CardDescription>
              </div>
              <Input
                className="h-9 w-28"
                type="number"
                min={0}
                max={365}
                value={settings.trashRetentionDays ?? 30}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    trashRetentionDays: Math.max(
                      0,
                      Math.min(365, Number(event.target.value) || 0),
                    ),
                  })
                }
              />
            </div>
          </>
          <>
            <Separator />
            <div className="flex items-center justify-between gap-4 p-4">
              <CardTitle id="keep-saves-label">
                Giữ saves vào thư mục recovered-saves khi tự dọn
              </CardTitle>
              <Switch
                aria-labelledby="keep-saves-label"
                checked={settings.keepSavesOnTrashCleanup ?? true}
                onCheckedChange={(keepSavesOnTrashCleanup) =>
                  setSettings({ ...settings, keepSavesOnTrashCleanup })
                }
              />
            </div>
          </>
        </Card>
      )}
      {section === "runtime" && (
        <JavaSettings settings={settings} setSettings={setSettings} />
      )}
      {section === "instance" && (
        <MinecraftSettings settings={settings} setSettings={setSettings} />
      )}
      {section === "about" && (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4">
            <CardTitle>Về launcher</CardTitle>
            <Box size={18} />
          </div>
          <>
            <Separator className="first:hidden" />
            <div className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex flex-col gap-1">
                <CardTitle>Gorth Launcher</CardTitle>
                <CardDescription>
                  Minecraft Java Edition · Phiên bản {info?.version ?? "0.0.0"}
                </CardDescription>
              </div>
              <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                {info?.platform ?? "Desktop"}
              </span>
            </div>
          </>
          <>
            <Separator />
            <div className="flex flex-col gap-4 p-4 [&_code]:break-all">
              <CardTitle>Thư mục dữ liệu ứng dụng</CardTitle>
              <code>{info?.dataPath ?? "Đang đọc…"}</code>
            </div>
          </>
        </Card>
      )}
      {section === "about" && <LauncherFooter />}
      {section === "about" && (
        <Card className="gap-4 p-4">
          <CardTitle>Content pages</CardTitle>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["content", "Mod & modpack"],
                ["mods", "Mods"],
                ["resourcepacks", "Resource Packs"],
                ["shaders", "Shader Packs"],
              ] as const
            ).map(([page, title]) => (
              <Button
                key={page}
                variant="outline"
                onClick={() => onNavigate?.(page)}
              >
                {title}
              </Button>
            ))}
          </div>
        </Card>
      )}
      {section === "history" && (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="flex flex-col gap-4 p-4">
            <CardDescription>
              {history.length} phiên
              {minecraftPreferences(settings).showTotalTime &&
                " · " +
                  formatPlayTime(
                    history.reduce((sum, item) => sum + item.duration, 0),
                    minecraftPreferences(settings).durationsInHours,
                  )}
            </CardDescription>
            <LaunchHistory
              history={history}
              locale={
                settings.locale === "system" ? undefined : settings.locale
              }
              hours={minecraftPreferences(settings).durationsInHours}
              showTime={minecraftPreferences(settings).showGameTime}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
