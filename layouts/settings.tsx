import { useState, type CSSProperties, type ReactNode } from "react";
import { SidebarProvider } from "@gorth-com/primitive/custom/sidebar";
import { Dashboard } from "@/layouts/dashboard";
import { Titlebar } from "@/layouts/title-bar";
import {
  NavigationBar,
  type NavigationBarProps,
} from "@/layouts/navigation-bar";
import { Wrapper } from "@/layouts/wrapper";
import type { Settings, Page } from "@/utils/interface";
import type { LauncherSettingsSection } from "@/utils/constant";

interface SettingsLayoutProps {
  section?: LauncherSettingsSection;
  settings: Settings;
  navigation: NavigationBarProps;
  onNavigate: (page: Page) => void;
  onMain: () => void;
  instanceCount: number;
  unreadCount: number;
  children: (section: LauncherSettingsSection) => ReactNode;
}
export function SettingsLayout({
  section: selectedSection,
  settings,
  navigation,
  onNavigate,
  onMain,
  instanceCount,
  unreadCount,
  children,
}: SettingsLayoutProps) {
  const [section, setSection] = useState<LauncherSettingsSection>("general");
  const [open, setOpen] = useState(true);
  const currentSection = selectedSection ?? section;
  const compact = settings.tabLayout === "compact";
  const controls = {
    ...navigation,
    sidebarOpen: open,
    onToggleSidebar:
      settings.sidebarCollapsible === false
        ? undefined
        : () => setOpen((value) => !value),
  };
  return (
    <div
      data-launcher-settings-layout
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
    >
      <Titlebar
        showLogo={settings.showTitlebarLogo ?? true}
        navigation={compact ? controls : undefined}
      />
      {!compact && <NavigationBar {...controls} />}
      <SidebarProvider
        open={settings.sidebarCollapsible === false || open}
        onOpenChange={setOpen}
        style={{ "--sidebar-width-icon": "3.5rem" } as CSSProperties}
        className="min-h-0 flex-1 overflow-hidden"
      >
        <Dashboard
          profileName={settings.profileName}
          profileIcon={settings.profileIcon}
          compact={compact}
          collapsible={settings.sidebarCollapsible ?? true}
          collapseMode={settings.sidebarCollapseMode ?? "none"}
          page="settings"
          onNavigate={onNavigate}
          instanceCount={instanceCount}
          unreadCount={unreadCount}
          settings={{
            section: currentSection,
            onSectionChange: (next) =>
              selectedSection
                ? onNavigate(`settings/${next}`)
                : setSection(next),
            onMain,
          }}
        />
        <main
          className="min-w-0 flex-1 overflow-y-auto"
          aria-label="Launcher settings content"
        >
          <Wrapper>{children(currentSection)}</Wrapper>
        </main>
      </SidebarProvider>
    </div>
  );
}
