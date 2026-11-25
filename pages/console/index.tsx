import { useState } from "react";
import {
  Copy,
  Eraser,
  FileDown,
  Square,
  Terminal,
} from "@gorth-com/primitive/cores/lucide";
import { Button } from "@gorth-com/primitive/custom/button";
import { Badge } from "@gorth-com/primitive/custom/badge";
import { Input } from "@gorth-com/primitive/default/input";
import { InstanceSelect } from "@/components/element/instance-select";
import { PageHeading } from "@/components/heading";
import { LogViewer } from "@/components/element/log-viewer";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import type { useGame } from "@/hooks/use-game";
import type { Instance, InstanceSelectionProps } from "@/utils/interface";
import { gamePhaseLabels } from "@/utils/constant";

export function ConsolePage({
  game,
  instances,
  run,
  exportLog,
  initialInstanceId = "",
  selectedInstanceId,
  onInstanceChange,
  fixedInstance = false,
}: ReturnType<typeof useGame> &
  Partial<InstanceSelectionProps> & {
    instances: Instance[];
    initialInstanceId?: string;
    fixedInstance?: boolean;
  }) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [cleared, setCleared] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  useFeedbackToast(message);
  const id = selectedInstanceId ?? initialInstanceId;
  const job = id
    ? game.jobs.find((item) => item.instanceId === id)
    : game.jobs[0];
  const marker = cleared[job?.instanceId ?? ""];
  const logs = (job?.logs ?? [])
    .slice(marker === undefined ? 0 : (job?.logs.lastIndexOf(marker) ?? -1) + 1)
    .filter(
      (line) =>
        line.toLowerCase().includes(query.toLowerCase()) &&
        (level === "all" || line.toLowerCase().includes(level)),
    );
  const note =
    "Console hiển thị buffer log của phiên hiện tại. Clear chỉ ẩn log trong giao diện; Export xuất buffer gốc.";
  return (
    <section
      data-game-console
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden"
    >
      {!fixedInstance && (
        <PageHeading
          title="Console"
          icon={Terminal}
          actions={
            <div className="w-60 min-w-0 shrink-0">
              <InstanceSelect
                label="Instance console"
                value={id || job?.instanceId || ""}
                onChange={(value) => {
                  onInstanceChange?.(value);
                  setMessage("");
                }}
                items={
                  instances.length
                    ? instances.map((item) => ({
                        value: item.id,
                        label: item.name,
                      }))
                    : [{ value: "", label: "Chưa có instance" }]
                }
              />
            </div>
          }
        />
      )}
      <div
        data-console-toolbar
        className="flex h-9 min-w-0 shrink-0 items-center justify-between gap-4"
      >
        <div className="flex h-9 min-w-0 items-center gap-4">
          <div className="flex min-w-0 flex-col justify-center text-xs leading-4 text-muted-foreground">
            <p
              className="truncate"
              title="Game logs, launch output, and process status."
            >
              Game logs, launch output, and process status.
            </p>
            <p className="truncate" title={note}>
              {note}
            </p>
          </div>
          <Badge
            className="shrink-0"
            variant={job?.phase === "crashed" ? "destructive" : "secondary"}
          >
            {job ? gamePhaseLabels[job.phase] : "Chưa chạy"}
          </Badge>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            disabled={!logs.length}
            onClick={() =>
              void navigator.clipboard.writeText(logs.join("\n")).then(
                () => setMessage("Đã sao chép log."),
                () => setMessage("Không sao chép được log."),
              )
            }
          >
            <Copy /> Copy
          </Button>
          <Button
            variant="outline"
            disabled={!job}
            onClick={() => {
              if (job?.logs.length)
                setCleared({
                  ...cleared,
                  [job.instanceId]: job.logs[job.logs.length - 1],
                });
            }}
          >
            <Eraser /> Clear
          </Button>
          <Button
            variant="outline"
            disabled={!job}
            onClick={() => {
              if (job) void exportLog(job.instanceId);
            }}
          >
            <FileDown /> Export
          </Button>
          <Button
            variant="destructive"
            disabled={
              !job ||
              ![
                "queued",
                "paused",
                "checking",
                "downloading",
                "starting",
                "running",
              ].includes(job.phase)
            }
            onClick={() => {
              if (job)
                void run({
                  action: job.phase === "running" ? "stop" : "cancel",
                  id: job.instanceId,
                });
            }}
          >
            <Square /> Stop
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 shrink-0 gap-2">
        <Input
          className="h-9 min-w-0 flex-1"
          aria-label="Tìm log"
          placeholder="Tìm trong console…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="w-40 shrink-0">
          <InstanceSelect
            label="Mức log"
            value={level}
            onChange={setLevel}
            items={["all", "info", "warn", "error", "debug"].map((value) => ({
              label: value,
              value,
            }))}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <LogViewer
          content={logs.length ? logs.join("\n") : "Chưa có log phù hợp."}
          fill
        />
      </div>
    </section>
  );
}
