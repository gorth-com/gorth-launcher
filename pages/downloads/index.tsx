import {
  Download,
  FolderOpen,
  Pause,
  Play,
  Square,
  X,
  Terminal,
  History,
} from "@gorth-com/primitive/cores/lucide";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@gorth-com/primitive/default/card";
import { Progress } from "@gorth-com/primitive/default/progress";
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
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeading
        icon={Download}
        title="Downloads"
        actions={
          <Button variant="outline" onClick={onHistory}>
            <History /> History
          </Button>
        }
      />
      <div
        data-downloads-layout
        className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-3"
      >
        <section className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card data-download-directory className="gap-4 p-4">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-0">
              <p className="min-w-0 flex-1 break-all text-sm text-muted-foreground">
                {game.directory}
              </p>
              <Button variant="outline" onClick={() => void openDirectory()}>
                <FolderOpen /> Mở thư mục Minecraft
              </Button>
            </CardContent>
          </Card>
          {!jobs.length && (
            <Card className="p-4">
              <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 p-0">
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
              <Card
                data-download-item
                key={job.instanceId}
                className="gap-4 p-4"
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 p-0">
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle>
                      {instances.find((item) => item.id === job.instanceId)
                        ?.name ?? job.instanceId}
                    </CardTitle>
                    <CardDescription>
                      Minecraft {job.version} · {gamePhaseLabels[job.phase]}
                      {job.queuePosition
                        ? " · vị trí " + job.queuePosition
                        : ""}
                    </CardDescription>
                  </div>
                  <div
                    data-download-actions
                    className="flex shrink-0 items-start gap-2"
                  >
                    <Button
                      variant="outline"
                      onClick={() => void openDirectory(job.instanceId)}
                    >
                      <FolderOpen /> Mở thư mục
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => onConsole(job.instanceId)}
                    >
                      <Terminal /> Console
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-0">
                  {busy && (
                    <div className="flex flex-wrap gap-2">
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
                      {["queued", "checking", "downloading"].includes(
                        job.phase,
                      ) && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            void run({ action: "pause", id: job.instanceId })
                          }
                        >
                          <Pause /> Tạm dừng
                        </Button>
                      )}
                      {job.phase === "paused" && (
                        <Button
                          onClick={() =>
                            void run({ action: "resume", id: job.instanceId })
                          }
                        >
                          <Play /> Tiếp tục
                        </Button>
                      )}
                    </div>
                  )}
                  {!["error", "crashed"].includes(job.phase) && (
                    <p role="status" className="text-sm">
                      {job.message}
                    </p>
                  )}
                  {job.total > 0 && (
                    <div className="flex flex-col gap-2">
                      <Progress
                        aria-label="Tiến độ tải Minecraft"
                        max={job.total}
                        value={job.completed}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(job.completed)} /{" "}
                        {formatNumber(job.total)} file ·{" "}
                        {formatTransferRate(job.speed)}
                        {job.eta
                          ? " · còn khoảng " + formatRemainingTime(job.eta)
                          : ""}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
        <aside className="min-w-0">
          <Card className="gap-4 p-4">
            <CardHeader className="p-0">
              <CardTitle>Hàng đợi</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="grid grid-cols-[1fr_auto] gap-4 text-sm">
                <dt>Game đang chạy</dt>
                <dd>{game.activeIds.length}</dd>
                <dt>Đang chờ</dt>
                <dd>{game.queue.length}</dd>
                <dt>Đang tải / kiểm tra</dt>
                <dd>
                  {
                    jobs.filter((job) =>
                      ["checking", "downloading"].includes(job.phase),
                    ).length
                  }
                </dd>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
