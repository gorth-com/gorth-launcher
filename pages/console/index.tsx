import { InstanceSelect } from "@/components/element/instance-select";
import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { useState } from "react";
import {
  Copy,
  Eraser,
  FileDown,
  Square,
  Terminal,
} from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import { Input } from "@gorth-io/primitive/default/input";
import { LogViewer } from "@/components/element/log-viewer";
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
  // Never fall back to another game's logs when the selected instance has no job.
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
  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Game logs, launch output, and process status.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {!fixedInstance && (
          <div className="min-w-48">
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
        )}
        <span className="flex-1 text-sm">
          {job ? gamePhaseLabels[job.phase] : "Chưa chạy"}
        </span>
        <Button
          className="h-9"
          variant="outline"
          disabled={!logs.length}
          onClick={() =>
            void navigator.clipboard.writeText(logs.join("\n")).then(
              () => setMessage("Đã sao chép log."),
              () => setMessage("Không sao chép được log."),
            )
          }
        >
          <Copy />
          Copy
        </Button>
        <Button
          className="h-9"
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
          <Eraser />
          Clear
        </Button>
        <Button
          className="h-9"
          variant="outline"
          disabled={!job}
          onClick={() => {
            if (job) void exportLog(job.instanceId);
          }}
        >
          <FileDown />
          Export
        </Button>
        <Button
          className="h-9"
          variant="outline"
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
          <Square />
          Stop
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          className="h-9 flex-1"
          aria-label="Tìm log"
          placeholder="Tìm trong console…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="w-40">
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

      <LogViewer
        content={logs.length ? logs.join("\n") : "Chưa có log phù hợp."}
        className="h-96"
      />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Terminal className="size-4" />
        Console hiển thị buffer log của phiên hiện tại. Clear chỉ ẩn log trong
        giao diện; Export xuất buffer gốc.
      </p>
    </section>
  );
}
