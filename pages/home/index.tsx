import { PageHeading } from "@/components/heading";
import {
  Home,
  Play,
  Plus,
  Square,
  Settings2,
} from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@gorth-io/primitive/default/card";
import {
  NativeSelect,
  NativeSelectOption,
} from "@gorth-io/primitive/default/native-select";
import { PageShell } from "@/layouts/page-shell";
import { PageBanner } from "@/components/element/page-banner";
import { InstanceIcon } from "@/utils/renderer";
import { formatDateTime } from "@/utils/formatter";
import type {
  AccountView,
  GameSnapshot,
  Instance,
  InstanceSelectionProps,
} from "@/utils/interface";
import background from "@/public/dawn/background1.png";

interface HomePageProps extends InstanceSelectionProps {
  instances: Instance[];
  game: GameSnapshot;
  accounts: AccountView[];
  accountId: string | null;
  onCreate: () => void;
  onOpenLibrary: () => void;
  onSelect: (item: Instance) => void;
  onPlay: (item: Instance) => void;
  onStop: (id: string) => void;
  onAccount: (id: string) => void;
}

export function HomePage({
  instances,
  game,
  accounts,
  accountId,
  selectedInstanceId,
  onInstanceChange,
  onCreate,
  onOpenLibrary,
  onSelect,
  onPlay,
  onStop,
  onAccount,
}: HomePageProps) {
  const selected =
    instances.find((item) => item.id === selectedInstanceId) ?? instances[0];
  const account = accounts.find((item) => item.id === accountId);
  const running = !!selected && game.activeIds.includes(selected.id);
  const job = game.jobs.find((item) => item.instanceId === selected?.id);
  const busy =
    !!job &&
    [
      "queued",
      "paused",
      "checking",
      "downloading",
      "starting",
      "stopping",
    ].includes(job.phase);
  const lastPlayed = new Map<string, number>();
  for (const session of game.history)
    lastPlayed.set(
      session.instanceId,
      Math.max(lastPlayed.get(session.instanceId) ?? 0, session.startedAt),
    );
  const recent = instances
    .filter((item) => lastPlayed.has(item.id))
    .sort((a, b) => lastPlayed.get(b.id)! - lastPlayed.get(a.id)!)
    .slice(0, 6);
  return (
    <PageShell>
      <PageHeading icon={Home} title="Home" />
      <PageBanner image={background}>
        <div className="flex flex-col gap-4">
          <CardTitle>{selected?.name ?? "Quick play"}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label="Instance trang chủ"
              value={selected?.id ?? ""}
              disabled={!instances.length}
              onChange={(event) => onInstanceChange?.(event.target.value)}
            >
              {!instances.length && (
                <NativeSelectOption value="">
                  Chưa có instance
                </NativeSelectOption>
              )}
              {instances.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Tài khoản game trang chủ"
              value={accountId ?? ""}
              disabled={!accounts.length}
              onChange={(event) => onAccount(event.target.value)}
            >
              <NativeSelectOption value="" disabled>
                Chọn tài khoản
              </NativeSelectOption>
              {accounts.map((item) => (
                <NativeSelectOption key={item.id} value={item.id}>
                  {item.username}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button
              disabled={!selected || busy || (!running && !account)}
              onClick={() => {
                if (selected) {
                  if (running) onStop(selected.id);
                  else onPlay(selected);
                }
              }}
            >
              {running ? <Square /> : <Play />}
              {busy ? "Đang chuẩn bị…" : running ? "Stop" : "Play"}
            </Button>
            <Button variant="outline" onClick={onOpenLibrary}>
              <Settings2 />
              Manage Instances
            </Button>
            <Button variant="outline" onClick={onCreate}>
              <Plus />
              New Instance
            </Button>
          </div>
        </div>
      </PageBanner>
      <Card>
        <CardHeader>
          <CardTitle>Recently played</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {recent.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4"
            >
              <Button
                variant="ghost"
                className="h-auto min-w-0 flex-1 justify-start p-2"
                onClick={() => {
                  onInstanceChange?.(item.id);
                  onSelect(item);
                }}
              >
                <InstanceIcon
                  data={item.iconData}
                  className="size-9 rounded-md"
                  iconClassName="size-4"
                />
                <span className="flex min-w-0 flex-col items-start gap-1">
                  <span className="truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.version} · {item.loader} ·{" "}
                    {formatDateTime(lastPlayed.get(item.id)!)}
                  </span>
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => onInstanceChange?.(item.id)}
              >
                Select
              </Button>
            </div>
          ))}
          {!recent.length && (
            <p className="text-sm text-muted-foreground">
              Chưa có instance đã chơi.
            </p>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
