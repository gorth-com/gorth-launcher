import { ScrollArea, ScrollBar } from "@gorth-io/primitive/default/scroll-area";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "@gorth-io/primitive/cores/lucide";
import {
  ArrowLeft,
  LogIn,
  KeySquare,
  UserRound,
  Globe2,
  Rocket,
  Star,
  User,
} from "@gorth-io/primitive/cores/lucide";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarContent,
  SidebarGroup,
  SidebarFooter,
  SidebarSeparator,
} from "@gorth-io/primitive/custom/sidebar";
import { Titlebar } from "@/layouts/title-bar";
import {
  NavigationBar,
  type NavigationBarProps,
} from "@/layouts/navigation-bar";
import { Wrapper } from "@/layouts/wrapper";
import { HeadingIcon } from "@/components/heading";
import { NavUser } from "@/components/dashboard/nav-user";
import { useAuth } from "@/hooks/use-auth";
import { AuthScreen } from "@/components/element/auth-screen";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/providers/tooltip";
import type { Settings, Page } from "@/utils/interface";
interface WorkspaceSection {
  id: string;
  title: string;
  icon: LucideIcon;
}
export interface InstanceWorkspaceProps {
  settings: Settings;
  navigation: NavigationBarProps;
  onBack: () => void;
  onNavigate: (page: Page) => void;
}
export function InstanceWorkspace({
  settings,
  navigation,
  onBack,
  onNavigate,
  sections,
  section,
  onSectionChange,
  children,
}: InstanceWorkspaceProps & {
  sections: readonly WorkspaceSection[];
  section: string;
  onSectionChange: (section: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const auth = useAuth();
  const compact = settings.tabLayout === "compact";
  const controls = {
    ...navigation,
    sidebarOpen: open,
    onToggleSidebar: () => setOpen((value) => !value),
  };
  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
      data-instance-workspace
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
        <Sidebar
          collapsible={
            settings.sidebarCollapsible === false
              ? "none"
              : settings.sidebarCollapseMode === "icon"
                ? "icon"
                : "offcanvas"
          }
          className={
            compact
              ? "top-14 h-[calc(100svh-3.5rem)]"
              : "top-28 h-[calc(100svh-7rem)]"
          }
        >
          <SidebarHeader className="group-data-[collapsible=icon]:items-center">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  className="h-14 group-data-[collapsible=icon]:p-0!"
                  onClick={onBack}
                >
                  <HeadingIcon icon={ArrowLeft} />
                  <span className="text-2xl font-semibold group-data-[collapsible=icon]:hidden">
                    Main
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarSeparator className="mx-0" />
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                {sections.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <SidebarMenuButton
                            aria-label={item.title}
                            className="group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center"
                            isActive={section === item.id}
                            onClick={() => onSectionChange(item.id)}
                          >
                            <item.icon />
                            <span className="group-data-[collapsible=icon]:hidden">
                              {item.title}
                            </span>
                          </SidebarMenuButton>
                        }
                      />
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarSeparator className="mx-0" />
          <SidebarFooter className="group-data-[collapsible=icon]:items-center">
            <NavUser
              auth={auth}
              localIcon={
                { globe: Globe2, user: User, rocket: Rocket, star: Star }[
                  settings.profileIcon ?? "user"
                ]
              }
              user={{
                name: auth.authenticated
                  ? (auth.account?.name ?? "Personal")
                  : (settings.profileName ?? "Personal"),
                email: auth.authenticated ? "authenticated" : "local",
                avatar: auth.authenticated ? auth.account?.image : undefined,
              }}
              nav={{
                main: [
                  {
                    title: "Gorth profile",
                    url: "settings/profile",
                    icon: UserRound,
                  },
                ],
                secondary: [
                  { title: "Sign in", url: "/sign-in", icon: LogIn },
                  { title: "Create account", url: "/sign-up", icon: KeySquare },
                ],
              }}
              onNavigate={(url) => onNavigate(url as Page)}
            />
          </SidebarFooter>
        </Sidebar>
        <ScrollArea
          role="main"
          render={<main aria-label="Instance workspace" />}
          className="h-full min-h-0 min-w-0 flex-1"
        >
          <Wrapper>{children}</Wrapper>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </SidebarProvider>
      <AuthScreen compact={compact} onReturn={() => {}} />
    </div>
  );
}
