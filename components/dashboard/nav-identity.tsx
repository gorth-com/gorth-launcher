import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "@gorth-com/primitive/cores/lucide";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@gorth-com/primitive/custom/avatar";
import { SidebarMenuButton } from "@gorth-com/primitive/custom/sidebar";
import { cn } from "@gorth-com/primitive/cores/cn";
import { formatUserInitials } from "@gorth-com/primitive/utils/formatter";
import type { UserProps } from "@gorth-com/primitive/utils/interface";

// Mirror Primitive's identity presentation without importing its Next.js module.
export function NavAvatar({
  user,
  icon: Icon,
}: {
  user: UserProps;
  icon?: LucideIcon;
}) {
  return (
    <Avatar className="size-9 shrink-0 cursor-default">
      <AvatarImage src={user.avatar || undefined} alt={user.name} />
      <AvatarFallback
        className="bg-muted-foreground text-primary-foreground"
        suppressHydrationWarning
      >
        {Icon ? <Icon className="size-4" /> : formatUserInitials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}
interface IdentityProps {
  user: UserProps;
  icon?: LucideIcon;
  description?: string;
  badge?: ReactNode;
}
export function NavName({ user, description, badge }: IdentityProps) {
  return (
    <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium" suppressHydrationWarning>
          {user.name}
        </span>
        {badge}
      </div>
      {(description ?? user.email) && (
        <span
          className="block min-w-0 truncate text-xs"
          suppressHydrationWarning
        >
          {description ?? user.email}
        </span>
      )}
    </div>
  );
}
export function NavIdentity({ user, description, badge, icon }: IdentityProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <NavAvatar user={user} icon={icon} />
      <NavName user={user} description={description} badge={badge} />
    </div>
  );
}
interface NavAccountProps extends ComponentProps<typeof SidebarMenuButton> {
  user: UserProps;
  icon?: LucideIcon;
  trailing?: ReactNode;
}
export function NavAccount({
  user,
  icon,
  trailing,
  className,
  ...props
}: NavAccountProps) {
  return (
    <SidebarMenuButton
      {...props}
      size="lg"
      className={cn(
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className,
        "h-14 w-full gap-2 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground not-data-[variant=destructive]:focus:**:text-sidebar-accent-foreground",
      )}
    >
      <NavIdentity user={user} icon={icon} />
      {trailing}
    </SidebarMenuButton>
  );
}
