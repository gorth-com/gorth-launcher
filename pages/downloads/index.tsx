import {
  Download,
  FolderOpen,
  Pause,
  Play,
  Square,
  X,
  Terminal,
  History,
} from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@gorth-io/primitive/default/card";
import { PageHeading } from "@/components/heading";
import { gamePhaseLabels } from "@/utils/constant";
import type { useGame } from "@/hooks/use-game";
import type { Instance } from "@/utils/interface";
import {
  formatNumber,
  formatRemainingTime,
  formatTransferRate,
} from "@/utils/formatter";

export function DownloadsPage({
  game,
  run,
  openDirectory,
  instances,
  onConsole,
  onHistory,
}: Pick<ReturnType<typeof useGame>, "game" | "run" | "openDirectory"> & {
  instances: Instance[];
  onConsole: (id: string) => void;
  onHistory: () => void;
}) {
  const jobs = game.jobs.filter((job) => job.phase !== "idle");
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        icon={Download}
        title="Downloads"
        actions={
          <Button variant="outline" onClick={onHistory}>
            <History />
            History
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-4">
        <p className="min-w-0 flex-1 break-all text-sm text-muted-foreground">
          {game.directory}
        </p>
        <span className="text-sm">
          {game.activeIds.length} game đang chạy · {game.queue.length} chờ
        </span>
        <Button variant="outline" onClick={() => void openDirectory()}>
          <FolderOpen />
          Mở thư mục Minecraft
        </Button>
      </div>
      {!jobs.length && (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4">
            <Download className="size-6 text-muted-foreground" />
            <CardTitle>Chưa có tác vụ</CardTitle>
          </CardContent>
        </Card>
      )}
      {jobs.map((job) => {
        const busy = [
          "queued",
          "checking",
          "downloading",
          "paused",
          "starting",
          "running",
          "stopping",
        ].includes(job.phase);
        return (
          <Card key={job.instanceId}>
            <CardHeader>
              <CardTitle>
                {instances.find((item) => item.id === job.instanceId)?.name ??
                  job.instanceId}
              </CardTitle>
              <CardDescription>
                Minecraft {job.version} · {gamePhaseLabels[job.phase]}
                {job.queuePosition ? ` · vị trí ${job.queuePosition}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void openDirectory(job.instanceId)}
                >
                  <FolderOpen />
                  Mở thư mục
                </Button>
                {busy && (
                  <Button
                    variant="outline"
                    disabled={job.phase === "stopping"}
                    onClick={() =>
                      void run({
                        action: job.phase === "running" ? "stop" : "cancel",
                        id: job.instanceId,
                      })
                    }
                  >
                    {job.phase === "running" ? <Square /> : <X />}
                    {job.phase === "running" ? "Dừng game" : "Hủy"}
                  </Button>
                )}
                {["queued", "checking", "downloading"].includes(job.phase) && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void run({ action: "pause", id: job.instanceId })
                    }
                  >
                    <Pause />
                    Tạm dừng
                  </Button>
                )}
                {job.phase === "paused" && (
                  <Button
                    onClick={() =>
                      void run({ action: "resume", id: job.instanceId })
                    }
                  >
                    <Play />
                    Tiếp tục
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => onConsole(job.instanceId)}
                >
                  <Terminal />
                  Console
                </Button>
              </div>
              {!["error", "crashed"].includes(job.phase) && (
                <p role="status" className="text-sm">
                  {job.message}
                </p>
              )}
              {job.total > 0 && (
                <div className="flex flex-col gap-2">
                  <progress
                    className="h-2 w-full accent-primary"
                    max={job.total}
                    value={job.completed}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(job.completed)} / {formatNumber(job.total)}{" "}
                    file · {formatTransferRate(job.speed)}
                    {job.eta
                      ? ` · còn khoảng ${formatRemainingTime(job.eta)}`
                      : ""}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
