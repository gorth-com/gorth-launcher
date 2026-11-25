import { Bell, CheckCheck, Trash2, X } from "@gorth-com/primitive/cores/lucide";
import { Button } from "@gorth-com/primitive/custom/button";
import { Badge } from "@gorth-com/primitive/custom/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@gorth-com/primitive/default/card";
import { PageHeading } from "@/components/heading";
import type { useNotifications } from "@/hooks/use-notifications";
import { formatDateTime } from "@/utils/formatter";

const notificationLabels = {
  info: "Thông tin",
  success: "Hoàn tất",
  error: "Lỗi",
  running: "Đang chạy",
};
export function NotificationsPage({
  items,
  unread,
  markRead,
  dismiss,
  clear,
}: ReturnType<typeof useNotifications>) {
  return (
    <section className="flex min-w-0 flex-col gap-6">
      <PageHeading
        title="Notifications"
        icon={Bell}
        actions={
          <div className="flex shrink-0 items-center gap-2">
            <Badge aria-label="Thông báo mới">{unread}</Badge>
            <Button variant="outline" disabled={!unread} onClick={markRead}>
              <CheckCheck /> Đánh dấu đã đọc
            </Button>
            <Button variant="outline" disabled={!items.length} onClick={clear}>
              <Trash2 /> Xóa tất cả
            </Button>
          </div>
        }
      />
      <div
        data-notifications-layout
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3"
      >
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          {items.map((item) => (
            <Card data-notification-item key={item.id} className="gap-4 p-4">
              <CardHeader className="p-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>
                      {formatDateTime(item.time)}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant={
                        item.kind === "error" ? "destructive" : "secondary"
                      }
                    >
                      {notificationLabels[item.kind ?? "info"]}
                    </Badge>
                    {!item.read && <Badge>Mới</Badge>}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Xóa thông báo"
                      onClick={() => dismiss(item.id)}
                    >
                      <X />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <p className="break-words text-sm">{item.body}</p>
              </CardContent>
            </Card>
          ))}
          {!items.length && (
            <Card className="p-4">
              <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 p-0">
                <Bell className="size-8 text-muted-foreground" />
                <p>Không có thông báo</p>
              </CardContent>
            </Card>
          )}
        </div>
        <aside className="min-w-0">
          <Card className="gap-4 p-4">
            <CardHeader className="p-0">
              <CardTitle>Thông báo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="grid grid-cols-[1fr_auto] gap-4 text-sm">
                <dt>Tất cả</dt>
                <dd>{items.length}</dd>
                <dt>Chưa đọc</dt>
                <dd>{unread}</dd>
                <dt>Đã đọc</dt>
                <dd>{items.length - unread}</dd>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}
