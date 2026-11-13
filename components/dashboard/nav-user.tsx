import type { LucideIcon } from "@gorth-io/primitive/cores/lucide";
import {
  EllipsisVertical,
  LogOut,
  User,
} from "@gorth-io/primitive/cores/lucide";
import { NavAccount, NavIdentity } from "@/components/dashboard/nav-identity";
import { Separator } from "@gorth-io/primitive/default/separator";
import {
  SidebarMenu,
  SidebarMenuItem,
} from "@gorth-io/primitive/custom/sidebar";
import type {
  NavDropdown,
  UserProps,
} from "@gorth-io/primitive/utils/interface";
import { DashboardMenu, DashboardMenuItem } from "@/components/dashboard/menu";
interface NavUserProps {
  localIcon?: LucideIcon;
  user: UserProps;
  nav: NavDropdown;
  auth: {
    authenticated: boolean;
    loading: boolean;
    busy?: boolean;
    login: () => unknown;
    register: () => unknown;
    logout: () => unknown;
  };
  onNavigate: (url: string) => void;
}
// Native menu and identity adapters avoid Next.js imports in the Vite dev graph.
export function NavUser({
  user,
  nav,
  auth,
  onNavigate,
  localIcon = User,
}: NavUserProps) {
  const disabled = auth.loading || auth.busy;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DashboardMenu
          label="Account menu"
          align="start"
          trigger={
            <NavAccount
              user={user}
              icon={auth.authenticated ? undefined : localIcon}
              disabled={disabled}
              className="group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&_.grid]:hidden group-data-[collapsible=icon]:[&_.ml-auto]:hidden group-data-[collapsible=icon]:[&>div]:flex-none"
              trailing={
                <EllipsisVertical className="ml-auto size-4 shrink-0" />
              }
            />
          }
        >
          {(close) => (
            <>
              <div className="flex items-center gap-2 p-2">
                <NavIdentity
                  user={user}
                  icon={auth.authenticated ? undefined : localIcon}
                />
              </div>
              <Separator className="my-1" />
              {(auth.authenticated ? nav.main : nav.secondary).map((item) => (
                <DashboardMenuItem
                  key={item.url}
                  disabled={disabled}
                  onClick={() => {
                    close();
                    if (!auth.authenticated && item.url.endsWith("/sign-in"))
                      void auth.login();
                    else if (
                      !auth.authenticated &&
                      item.url.endsWith("/sign-up")
                    )
                      void auth.register();
                    else onNavigate(item.url);
                  }}
                >
                  <item.icon />
                  <span className="truncate">{item.title}</span>
                </DashboardMenuItem>
              ))}
              {auth.authenticated && (
                <>
                  <Separator className="my-1" />
                  <DashboardMenuItem
                    disabled={disabled}
                    onClick={() => {
                      close();
                      void auth.logout();
                    }}
                  >
                    <LogOut />
                    Sign out
                  </DashboardMenuItem>
                </>
              )}
            </>
          )}
        </DashboardMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
