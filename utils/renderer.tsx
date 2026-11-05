import {
  Box,
  Gamepad2,
  Mountain,
  Rocket,
  Star,
  Flame,
} from "@gorth-io/primitive/cores/lucide";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@gorth-io/primitive/custom/avatar";
import { cn } from "@gorth-io/primitive/cores/cn";
export const instanceIcons = {
  box: Box,
  gamepad: Gamepad2,
  mountain: Mountain,
  rocket: Rocket,
  star: Star,
  flame: Flame,
};
export function InstanceIcon({
  data,
  className,
  iconClassName = "size-16",
}: {
  data?: string | null;
  className?: string;
  iconClassName?: string;
}) {
  const Icon =
    instanceIcons[data?.slice(7) as keyof typeof instanceIcons] ?? Box;
  return (
    <Avatar className={cn("size-32 overflow-hidden rounded-2xl", className)}>
      {data && !data.startsWith("lucide:") && (
        <AvatarImage src={data} alt="" className="rounded-2xl" />
      )}
      <AvatarFallback className="rounded-2xl bg-muted text-muted-foreground">
        <Icon className={cn(iconClassName, "shrink-0")} />
      </AvatarFallback>
    </Avatar>
  );
}
