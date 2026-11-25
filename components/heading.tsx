import type { ReactNode } from "react";
import type { NavSubItem } from "@gorth-com/primitive/utils/interface";
import type { LucideIcon } from "@gorth-com/primitive/cores/lucide";
import { CardTitle, CardDescription } from "@gorth-com/primitive/default/card";

export interface PageHeadingProps extends Pick<
  NavSubItem,
  "title" | "icon" | "description"
> {
  actions?: ReactNode;
}
interface PageDescriptionProps {
  description?: string;
  address?: string;
  illustration?: ReactNode;
}
export function HeadingIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <Icon className="size-4" />
    </div>
  );
}
export function PageHeading({
  title,
  description,
  icon,
  actions,
}: PageHeadingProps) {
  return (
    <header className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-4">
        {icon && <HeadingIcon icon={icon} />}
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle className="text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
      </div>
      {actions}
    </header>
  );
}
export function PageDescription({
  description,
  address,
  illustration,
}: PageDescriptionProps) {
  return (
    <div className="flex items-start gap-4">
      {illustration}
      <div className="flex min-w-0 flex-col gap-2">
        {description && <CardDescription>{description}</CardDescription>}
        {address && <CardDescription>{address}</CardDescription>}
      </div>
    </div>
  );
}
