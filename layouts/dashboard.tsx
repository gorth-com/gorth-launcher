import { HeadingIcon } from "@/components/heading";
import { Fragment } from "react";
import {
  navigation,
  launcherSettingsSections,
  type LauncherSettingsSection,
} from "@/utils/constant";
import {
  Box,
  ArrowLeft,
  Info,
  LogIn,
  KeySquare,
  UserRound,
  Globe2,
  Rocket,
  Star,
  User,
} from "@gorth-io/primitive/cores/lucide";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@gorth-io/primitive/custom/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/providers/tooltip";
import { NavUser } from "@/components/dashboard/nav-user";
import { useAuth } from "@/hooks/use-auth";
import { SidebarMenuBadge } from "@gorth-io/primitive/custom/sidebar";

import type { Page } from "@/utils/interface";
import { cn } from "@gorth-io/primitive/cores/cn";
interface DashboardProps {
  profileName?: string;
  profileIcon?: "globe" | "user" | "rocket" | "star";
  settings?: {
    section: LauncherSettingsSection;
    onSectionChange: (section: LauncherSettingsSection) => void;
    onMain: () => void;
  };
  collapsible?: boolean;
  collapseMode?: "icon" | "none";
  compact?: boolean;
  page: Page;
  onNavigate: (page: Page) => void;
  instanceCount: number;
  unreadCount: number;
}
export function Dashboard({
  profileName = "Personal",
  profileIcon = "user",
  settings,
  collapsible = true,
  collapseMode = "none",
  compact = false,
  page,
  onNavigate,
  instanceCount,
  unreadCount,
}: DashboardProps) {
  const auth = useAuth();
  const account = auth.account;
  const navigate = (url: string) => {
    const target = navigation.find((item) => item.id === url);
    if (target) onNavigate(target.id);
    else if (url === "accounts") onNavigate("accounts");
    else if (url === "settings/help") onNavigate("settings/help");
  };
  return (
    <Sidebar
      collapsible={
        collapsible ? (collapseMode === "icon" ? "icon" : "offcanvas") : "none"
      }
      className={cn(
        compact
          ? "top-14 h-[calc(100svh-3.5rem)]"
          : "top-28 h-[calc(100svh-7rem)]",
        !collapsible && "border-r",
      )}
    >
      <SidebarHeader className="group-data-[collapsible=icon]:items-center">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="h-14 group-data-[collapsible=icon]:p-0!"
              onClick={() =>
                settings ? settings.onMain() : onNavigate("home")
              }
            >
              <HeadingIcon icon={settings ? ArrowLeft : Box} />
              <span className="truncate text-2xl font-bold tracking-tight group-data-[collapsible=icon]:hidden">
                {settings ? "Main" : "Launcher"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent>
        {(settings
          ? [
              launcherSettingsSections.filter((item) => item.id !== "about"),
              launcherSettingsSections.filter((item) => item.id === "about"),
            ]
          : [navigation]
        ).map((items, index) => (
          <Fragment key={index}>
            {index > 0 && <SidebarSeparator className="mx-0 -my-2" />}
            <SidebarGroup className="group-data-[collapsible=icon]:items-center">
              <SidebarMenu>
                {items.map((item) => {
                  const active =
                    (settings
                      ? settings.section === item.id
                      : page === item.id) ||
                    (item.id === "settings" && page === "settings/help");
                  const badge =
                    item.id === "instances"
                      ? instanceCount
                      : item.id === "notifications" && unreadCount > 0
                        ? unreadCount
                        : undefined;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <SidebarMenuButton
                              aria-label={item.label}
                              aria-current={active ? "page" : undefined}
                              isActive={active}
                              className="group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center"
                              onClick={() => {
                                if (settings)
                                  settings.onSectionChange(
                                    item.id as LauncherSettingsSection,
                                  );
                                else onNavigate(item.id as Page);
                              }}
                            >
                              <item.icon />
                              <span className="group-data-[collapsible=icon]:hidden">
                                {item.label}
                              </span>
                            </SidebarMenuButton>
                          }
                        />
                        <TooltipContent side="right">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                      {badge !== undefined && (
                        <SidebarMenuBadge className="size-6 rounded-md bg-muted">
                          {badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          </Fragment>
        ))}
      </SidebarContent>
      <SidebarSeparator className="mx-0" />
      <SidebarFooter className="group-data-[collapsible=icon]:items-center">
        <NavUser
          localIcon={
            { globe: Globe2, user: User, rocket: Rocket, star: Star }[
              profileIcon
            ]
          }
          auth={auth}
          onNavigate={navigate}
          user={{
            name: auth.authenticated
              ? (account?.name ?? "Personal")
              : profileName,
            email: auth.authenticated ? "authenticated" : "local",
            avatar: auth.authenticated ? account?.image : undefined,
          }}
          nav={{
            main: [
              { title: "Tài khoản", url: "accounts", icon: UserRound },
              { title: "Về Gorth Launcher", url: "settings/help", icon: Info },
            ],
            secondary: [
              { title: "Sign in", url: "/sign-in", icon: LogIn },
              { title: "Create account", url: "/sign-up", icon: KeySquare },
            ],
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
