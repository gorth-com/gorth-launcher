import type { H3Event } from "nitro/h3";
import { desktopContext } from "@/lib/server/context";

export function actReceiveAuthCallback(event: H3Event) {
  const accepted = desktopContext(event).receiveAuthCallback(event.req.url);
  return new Response(
    accepted
      ? "Đã nhận phản hồi xác thực. Bạn có thể trở lại ứng dụng."
      : "Phản hồi xác thực không hợp lệ hoặc đã hết hạn.",
    {
      status: accepted ? 200 : 400,
      headers: { "Content-Type": "text/plain; charset=UTF-8" },
    },
  );
}
