import { useEffect, useRef, useState } from "react";
import { Copy, FileDown, RefreshCw } from "@gorth-com/primitive/cores/lucide";
import { Button } from "@gorth-com/primitive/custom/button";
import { Checkbox } from "@gorth-com/primitive/default/checkbox";
import { Input } from "@gorth-com/primitive/default/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@gorth-com/primitive/default/field";
import { InstanceSelect } from "./instance-select";
import { LogViewer } from "./log-viewer";
import { confirmAction } from "@/lib/confirmation";
import { toast } from "@/providers/toaster";
import { cn } from "@gorth-com/primitive/cores/cn";
import type {
  InstanceDataSnapshot,
  InstanceDataCommand,
} from "@/lib/instance/interface";

export function InstanceLogs({
  instanceId,
  logs,
  busy,
  onSnapshot,
  onReload,
  fill = false,
}: {
  instanceId: string;
  logs: InstanceDataSnapshot["logs"];
  busy: boolean;
  onSnapshot: (snapshot: InstanceDataSnapshot) => void;
  onReload: () => void;
  fill?: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [content, setContent] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [working, setWorking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [wrap, setWrap] = useState(true);
  const [color, setColor] = useState(false);
  const [query, setQuery] = useState("");
  const [activeLine, setActiveLine] = useState<number>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const item = logs.find((entry) => entry.kind + ":" + entry.name === selected);
  useEffect(() => {
    if (!logs.some((entry) => entry.kind + ":" + entry.name === selected))
      setSelected(logs[0] ? logs[0].kind + ":" + logs[0].name : "");
  }, [logs, selected]);
  useEffect(() => {
    let active = true;
    setContent("");
    setTruncated(false);
    setActiveLine(undefined);
    if (!item) {
      setWorking(false);
      return;
    }
    setWorking(true);
    window.electronAPI.instanceData
      .command({
        action: "log.read",
        instanceId,
        kind: item.kind,
        name: item.name,
      })
      .then((result) => {
        if (!active) return;
        if (!result.ok || !result.data) throw new Error(result.error);
        setContent(result.data.content ?? "");
        setTruncated(result.data.truncated ?? false);
      })
      .catch((error) => {
        if (active)
          toast.add({
            title:
              error instanceof Error ? error.message : "Không đọc được log.",
            type: "error",
          });
      })
      .finally(() => {
        if (active) setWorking(false);
      });
    return () => {
      active = false;
    };
  }, [instanceId, selected, revision]);
  async function act(command: InstanceDataCommand, confirmation?: string) {
    if (confirmation && !(await confirmAction(confirmation))) return;
    setWorking(true);
    try {
      const result = await window.electronAPI.instanceData.command(command);
      if (!result.ok || !result.data) throw new Error(result.error);
      onSnapshot(result.data.snapshot);
    } catch (error) {
      toast.add({
        title:
          error instanceof Error ? error.message : "Thao tác log thất bại.",
        type: "error",
      });
    } finally {
      setWorking(false);
    }
  }
  function find() {
    if (!query.trim()) return;
    const lines = content.split("\n");
    const matches = lines.flatMap((line, index) =>
      line.toLocaleLowerCase().includes(query.toLocaleLowerCase())
        ? [index]
        : [],
    );
    const next =
      matches.find((index) => index > (activeLine ?? -1)) ?? matches[0];
    if (next === undefined) {
      toast.add({ title: "Không tìm thấy nội dung trong log." });
      return;
    }
    setActiveLine(next);
    requestAnimationFrame(() => {
      const viewport = scrollRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      );
      const line = scrollRef.current?.querySelector<HTMLElement>(
        '[data-log-line="' + next + '"]',
      );
      if (viewport && line)
        viewport.scrollTop +=
          line.getBoundingClientRect().top -
          viewport.getBoundingClientRect().top -
          viewport.clientHeight / 2;
    });
  }
  const disabled = working;
  return (
    <section
      data-other-logs
      className={cn(
        "flex min-w-0 flex-col gap-4",
        fill ? "min-h-0 flex-1" : "h-[600px]",
      )}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <InstanceSelect
            label="Other log file"
            value={selected}
            onChange={setSelected}
            disabled={disabled || !logs.length}
            items={
              logs.length
                ? logs.map((entry) => ({
                    value: entry.kind + ":" + entry.name,
                    label:
                      (entry.kind === "log" ? "logs/" : "crash-reports/") +
                      entry.name,
                  }))
                : [{ value: "", label: "Không có log" }]
            }
          />
        </div>
        <Button
          variant="destructive"
          disabled={disabled || busy || !item}
          onClick={() => {
            if (item)
              void act(
                {
                  action: "log.delete",
                  instanceId,
                  kind: item.kind,
                  name: item.name,
                },
                "Đưa log này vào thùng rác?",
              );
          }}
        >
          Delete Selected
        </Button>
        <Button
          variant="destructive"
          disabled={disabled || busy || !logs.length}
          onClick={() =>
            void act(
              { action: "log.delete-all", instanceId },
              "Đưa toàn bộ log và crash report của instance vào thùng rác?",
            )
          }
        >
          Delete All
        </Button>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4">
        <FieldGroup className="flex-row gap-4">
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id={"wrap-log-" + instanceId}
              checked={wrap}
              onCheckedChange={(value) => setWrap(value === true)}
            />
            <FieldLabel htmlFor={"wrap-log-" + instanceId}>
              Wrap lines
            </FieldLabel>
          </Field>
          <Field orientation="horizontal" className="w-auto">
            <Checkbox
              id={"color-log-" + instanceId}
              checked={color}
              onCheckedChange={(value) => setColor(value === true)}
            />
            <FieldLabel htmlFor={"color-log-" + instanceId}>
              Color lines
            </FieldLabel>
          </Field>
        </FieldGroup>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            disabled={!content}
            onClick={() =>
              void navigator.clipboard.writeText(content).catch(() =>
                toast.add({
                  title: "Không sao chép được log.",
                  type: "error",
                }),
              )
            }
          >
            <Copy /> Copy
          </Button>
          <Button
            variant="outline"
            disabled={disabled || !item}
            onClick={() => {
              if (item)
                void act({
                  action: "log.export",
                  instanceId,
                  kind: item.kind,
                  name: item.name,
                });
            }}
          >
            <FileDown /> Export
          </Button>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => {
              onReload();
              setRevision((value) => value + 1);
            }}
          >
            <RefreshCw /> Reload
          </Button>
        </div>
      </div>
      {truncated && (
        <p className="shrink-0 text-xs text-muted-foreground">
          Đang hiển thị 2 MB cuối của log. Export lưu file gốc đầy đủ.
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <LogViewer
          content={
            working ? "Đang đọc log…" : content || "Chưa có nội dung log."
          }
          fill
          wrap={wrap}
          color={color}
          activeLine={activeLine}
          scrollRef={scrollRef}
        />
      </div>
      <form
        className="flex shrink-0 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          find();
        }}
      >
        <Input
          className="min-w-0 flex-1"
          aria-label="Search other logs"
          placeholder="Search…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveLine(undefined);
          }}
        />
        <Button
          type="submit"
          variant="outline"
          disabled={!content || !query.trim()}
        >
          Find
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const viewport = scrollRef.current?.querySelector<HTMLElement>(
              '[data-slot="scroll-area-viewport"]',
            );
            if (viewport) viewport.scrollTop = viewport.scrollHeight;
          }}
        >
          Bottom
        </Button>
      </form>
    </section>
  );
}
