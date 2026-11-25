import { Clock, Play, Settings } from "@gorth-com/primitive/cores/lucide";
import { Badge } from "@gorth-com/primitive/custom/badge";
import { Button } from "@gorth-com/primitive/default/button";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-com/primitive/default/card";
import type { Instance } from "@/utils/interface";
import { InstanceIcon } from "@/utils/renderer";
export interface InstanceCardsProps {
  playTimeLabel?: (id: string) => string | undefined;
  items: Instance[];
  onSelect: (instance: Instance) => void;
  onPlay?: (instance: Instance) => void;
  playDisabled?: (id: string) => boolean;
  statusLabel: (id: string) => string;
  layout?: "grid" | "list";
}
export function InstanceCards({
  items,
  onSelect,
  onPlay,
  playDisabled,
  statusLabel,
  playTimeLabel,
  layout = "grid",
}: InstanceCardsProps) {
  return (
    <div
      className={layout === "list" ? "grid gap-6" : "grid gap-6 xl:grid-cols-2"}
    >
      {items.map((item) => (
        <Card
          key={item.id}
          className={
            layout === "list"
              ? "flex flex-col gap-4 overflow-hidden p-4 sm:flex-row sm:items-start"
              : "gap-4 overflow-hidden p-4"
          }
        >
          <InstanceIcon
            data={item.iconData}
            className={layout === "grid" ? "h-36 w-full" : undefined}
          />
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 self-stretch">
            <div
              className={`flex items-start justify-between gap-4 ${layout === "grid" ? "flex-col" : "flex-wrap"}`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <CardTitle className="truncate">{item.name}</CardTitle>
                <CardDescription>
                  {item.group ?? "Minecraft Java Edition"}
                </CardDescription>
              </div>
              <div
                className={
                  layout === "list"
                    ? "flex shrink-0 items-center gap-2"
                    : "flex w-full items-center gap-2"
                }
              >
                <Button
                  className={layout === "grid" ? "flex-1" : undefined}
                  disabled={!onPlay || playDisabled?.(item.id)}
                  onClick={() => onPlay?.(item)}
                >
                  <Play />
                  Play now
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={`Chi tiết ${item.name}`}
                  title="Chi tiết"
                  onClick={() => onSelect(item)}
                >
                  <Settings />
                </Button>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{item.loader}</Badge>
              <Badge variant="secondary">{item.version}</Badge>
              {item.loaderVersion && (
                <Badge variant="outline">{item.loaderVersion}</Badge>
              )}
              <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {playTimeLabel?.(item.id) ?? statusLabel(item.id)}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
