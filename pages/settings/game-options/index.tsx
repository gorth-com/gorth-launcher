import type { ReactNode } from "react";
import { CardDescription, CardTitle } from "@gorth-com/primitive/default/card";
import { Switch } from "@gorth-com/primitive/default/switch";
export function GameOption({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      {children}
    </div>
  );
}
export function GameToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <GameOption title={title} description={description}>
      <Switch aria-label={title} checked={checked} onCheckedChange={onChange} />
    </GameOption>
  );
}
