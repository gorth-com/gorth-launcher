import type { ContentStatus } from "@/lib/content/interface";

export function mergeContentProgress(
  previous: ContentStatus,
  next: ContentStatus,
): ContentStatus {
  if (next.logs?.length) return next;
  const logs =
    next.busy && (!previous.busy || next.message === "Đang chuẩn bị…")
      ? []
      : (previous.logs ?? []);
  const line =
    next.total > 0
      ? `${next.message} (${next.completed}/${next.total})`
      : next.message;
  return {
    ...next,
    logs: line && logs.at(-1) !== line ? [...logs, line].slice(-1000) : logs,
  };
}
