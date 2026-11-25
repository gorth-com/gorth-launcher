import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { useEffect, useRef, useState } from "react";
import { Keyboard, RotateCcw } from "@gorth-com/primitive/cores/lucide";
import { Button } from "@gorth-com/primitive/custom/button";
import { Badge } from "@gorth-com/primitive/custom/badge";
import { Card } from "@gorth-com/primitive/default/card";
import { PageHeading, PageDescription } from "@/components/heading";
import type { Shortcut } from "@/lib/shortcuts";
import { shortcutDefinitions } from "@/utils/constant";

export function ShortcutsPage() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [recording, setRecording] = useState<string | null>(null);
  const [error, setError] = useState("");
  useFeedbackToast(error);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void window.electronAPI.shortcuts
      .list()
      .then((items) => {
        if (mounted.current) setShortcuts(items);
      })
      .catch(() => {
        if (mounted.current) setError("Unable to load shortcuts.");
      });
    return () => {
      mounted.current = false;
      void window.electronAPI.shortcuts.capture(false);
    };
  }, []);
  const run = async (operation: () => Promise<Shortcut[]>) => {
    setBusy(true);
    setError("");
    try {
      const items = await operation();
      if (mounted.current) setShortcuts(items);
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to save shortcuts.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const stopRecording = () => {
    setRecording(null);
    void window.electronAPI.shortcuts
      .capture(false)
      .catch(() => setError("Unable to restore shortcuts."));
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        icon={Keyboard}
        title="Shortcuts"
        actions={
          <Button
            variant="outline"
            disabled={busy || !shortcuts.length}
            onClick={() => {
              stopRecording();
              void run(() => window.electronAPI.shortcuts.reset());
            }}
          >
            <RotateCcw className="size-4" /> Reset all
          </Button>
        }
      />
      <PageDescription
        description="Change keyboard shortcuts for Gorth Launcher."
        address="gorth://settings/shortcuts"
        illustration={
          <div
            role="img"
            aria-label="Keyboard shortcuts illustration placeholder"
            className="flex h-24 w-40 shrink-0 items-center justify-center gap-2 rounded-lg border bg-muted text-muted-foreground"
          >
            <Keyboard aria-hidden="true" className="size-10" />
          </div>
        }
      />
      <section aria-label="Shortcuts" className="flex flex-col gap-2">
        {shortcuts.map((shortcut) => (
          <Card
            key={shortcut.id}
            className="h-14 flex-row items-center gap-2 rounded-lg p-2.5 shadow-none"
          >
            <div
              aria-label="Default shortcut"
              className="flex shrink-0 items-center gap-2"
            >
              {(
                shortcutDefinitions.find((item) => item.id === shortcut.id)
                  ?.defaultAccelerator || "Not assigned"
              )
                .split("+")
                .map((key, index) => (
                  <Button
                    key={index}
                    nativeButton={false}
                    render={<span />}
                    variant="outline"
                    size="sm"
                  >
                    {key === "CmdOrCtrl"
                      ? window.electronAPI.windowState.isMacOS
                        ? "⌘"
                        : "Ctrl"
                      : key}
                  </Button>
                ))}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">to</span>
            <Button
              variant="ghost"
              className="h-auto shrink-0 gap-2 p-0 hover:bg-transparent"
              disabled={busy}
              aria-label={shortcut.label}
              aria-pressed={recording === shortcut.id}
              onFocus={() => {
                void window.electronAPI.shortcuts
                  .capture(true)
                  .then(() => {
                    if (
                      mounted.current &&
                      document.activeElement?.getAttribute("aria-label") ===
                        shortcut.label
                    )
                      setRecording(shortcut.id);
                    else void window.electronAPI.shortcuts.capture(false);
                  })
                  .catch(() => setError("Unable to record shortcut."));
              }}
              onBlur={stopRecording}
              onKeyDown={(event) => {
                if (recording !== shortcut.id) return;
                event.preventDefault();
                event.stopPropagation();
                if (event.key === "Escape") {
                  event.currentTarget.blur();
                  return;
                }
                if (["Meta", "Control", "Alt", "Shift"].includes(event.key))
                  return;
                const clear =
                  ["Delete", "Backspace"].includes(event.key) &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.altKey;
                const accelerator = clear
                  ? ""
                  : [
                      event.metaKey
                        ? "CmdOrCtrl"
                        : event.ctrlKey
                          ? window.electronAPI.windowState.isMacOS
                            ? "Ctrl"
                            : "CmdOrCtrl"
                          : "",
                      event.altKey ? "Alt" : "",
                      event.shiftKey ? "Shift" : "",
                      event.key === " "
                        ? "Space"
                        : event.key === "+"
                          ? "Plus"
                          : event.key.length === 1
                            ? event.key.toUpperCase()
                            : event.key,
                    ]
                      .filter(Boolean)
                      .join("+");
                event.currentTarget.blur();
                void run(() =>
                  window.electronAPI.shortcuts.update(shortcut.id, accelerator),
                );
              }}
            >
              {(recording === shortcut.id
                ? "Press shortcut…"
                : shortcut.accelerator || "Not assigned"
              )
                .split("+")
                .map((key, index) => (
                  <span
                    key={index}
                    className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground"
                  >
                    {key === "CmdOrCtrl"
                      ? window.electronAPI.windowState.isMacOS
                        ? "⌘"
                        : "Ctrl"
                      : key}
                  </span>
                ))}
            </Button>
            <Badge variant="secondary">{shortcut.label}</Badge>
            <Button
              aria-label={`Reset ${shortcut.label}`}
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0"
              disabled={busy}
              onClick={() =>
                void run(() => window.electronAPI.shortcuts.reset(shortcut.id))
              }
            >
              <RotateCcw className="size-4" />
            </Button>
          </Card>
        ))}
      </section>
    </div>
  );
}
