import { useEffect, useId } from "react";
import { toast } from "@/providers/toaster";

export function useFeedbackToast(
  message: string | null | undefined,
  type?: "error" | "warning" | "success" | "info",
) {
  const id = useId();
  useEffect(() => {
    if (!message) return;
    toast.add({
      id,
      title: message,
      type: type ?? (message.startsWith("Đã ") ? "success" : "error"),
    });
  }, [id, message, type]);
}
