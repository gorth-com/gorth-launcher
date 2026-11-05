export interface ConfirmationOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}
export interface ConfirmationRequest extends ConfirmationOptions {
  id: string;
}
export function createConfirmationQueue() {
  let items: ConfirmationRequest[] = [];
  const pending = new Map<string, (answer: boolean) => void>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    current: () => items[0] ?? null,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    ask: (
      options: string | ConfirmationOptions,
      id: string = crypto.randomUUID(),
    ) =>
      new Promise<boolean>((resolve) => {
        const request = {
          ...(typeof options === "string" ? { title: options } : options),
          id,
        };
        pending.set(request.id, resolve);
        items = [...items, request];
        emit();
      }),
    answer: (id: string, answer: boolean) => {
      const resolve = pending.get(id);
      if (!resolve) return;
      pending.delete(id);
      items = items.filter((item) => item.id !== id);
      resolve(answer);
      emit();
    },
    cancelAll: () => {
      const callbacks = [...pending.values()];
      pending.clear();
      items = [];
      callbacks.forEach((resolve) => resolve(false));
      emit();
    },
  };
}
export const confirmations = createConfirmationQueue();
export const confirmAction = confirmations.ask;
export const confirmationChannels = {
  request: "confirmation:request",
  answer: "confirmation:answer",
  cancel: "confirmation:cancel",
} as const;
