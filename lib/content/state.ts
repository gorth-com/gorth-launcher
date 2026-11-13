import type { ContentStatus, OptionalMod } from "./interface";
let optionalSelection: {
  requestId: string;
  accept: (ids: string[]) => void;
} | null = null;
let controller: AbortController | null = null;
let status: ContentStatus = {
  busy: false,
  message: "",
  completed: 0,
  total: 0,
};
const listeners = new Set<(status: ContentStatus) => void>();
export const contentIsBusy = () => controller !== null;
export const contentSnapshot = () => ({
  ...status,
  logs: [...(status.logs ?? [])],
  optionalMods: status.optionalMods
    ? {
        ...status.optionalMods,
        items: status.optionalMods.items.map((item) => ({ ...item })),
      }
    : undefined,
});
export function selectOptionalMods(requestId: string, ids: string[]) {
  if (!optionalSelection || optionalSelection.requestId !== requestId)
    throw new Error("Yêu cầu chọn mod đã hết hạn.");
  const allowed = new Set(status.optionalMods?.items.map((item) => item.id));
  if (ids.some((id) => !allowed.has(id)))
    throw new Error("Mod tùy chọn không hợp lệ.");
  optionalSelection.accept([...new Set(ids)]);
}
export async function requestOptionalMods(
  items: OptionalMod[],
  signal: AbortSignal,
) {
  if (!items.length) return [];
  signal.throwIfAborted();
  const requestId = crypto.randomUUID();
  updateContent("Chọn mod tùy chọn");
  return new Promise<string[]>((resolve, reject) => {
    const clear = () => {
      signal.removeEventListener("abort", abort);
      optionalSelection = null;
      updateContent("Tiếp tục cài đặt…");
    };
    const abort = () => {
      clear();
      reject(new Error("Đã hủy cài nội dung."));
    };
    optionalSelection = {
      requestId,
      accept: (ids) => {
        clear();
        resolve(ids);
      },
    };
    signal.addEventListener("abort", abort, { once: true });
    status = { ...status, optionalMods: { requestId, items } };
    for (const listener of listeners) listener(contentSnapshot());
    if (signal.aborted) abort();
  });
}
export function subscribeContent(listener: (status: ContentStatus) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function updateContent(message: string, completed = 0, total = 0) {
  const line = total > 0 ? `${message} (${completed}/${total})` : message;
  const logs = status.logs ?? [];
  status = {
    busy: contentIsBusy(),
    message,
    completed,
    total,
    logs: logs.at(-1) === line ? logs : [...logs, line].slice(-1000),
  };
  for (const listener of listeners) listener(contentSnapshot());
}
export function beginContent() {
  if (controller) throw new Error("Đang xử lý mod/modpack. Vui lòng chờ.");
  controller = new AbortController();
  status = { busy: true, message: "", completed: 0, total: 0, logs: [] };
  updateContent("Đang chuẩn bị…");
  return controller.signal;
}
export function finishContent(error?: string) {
  controller = null;
  status = {
    ...status,
    busy: false,
    error,
    completed: error ? status.completed : status.total,
    message: error ?? "Đã cài đặt. Mở Thư viện để tải/chạy game.",
    logs: [...(status.logs ?? []), error ?? "Cài đặt hoàn tất."].slice(-1000),
  };
  for (const listener of listeners) listener(contentSnapshot());
}
export const cancelContent = () => controller?.abort();
