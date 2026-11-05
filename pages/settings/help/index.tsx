import { Info } from "@gorth-io/primitive/cores/lucide";
import { PageHeading } from "@/components/heading";
import { AppUpdateCard } from "@/components/element/app-update-card";
import { LauncherFooter } from "@/components/element/launcher-footer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@gorth-io/primitive/default/card";
import type { LauncherInfo } from "@/preload/interface";

export function HelpPage({ info }: { info: LauncherInfo | null }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Gorth Launcher" icon={Info} />
      <AppUpdateCard />
      <Card>
        <CardHeader>
          <CardTitle>Gorth Launcher</CardTitle>
          <CardDescription>gorth://settings/help</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>Minecraft Java Edition · Phiên bản {info?.version ?? "0.0.0"}</p>
          <p className="text-muted-foreground">{info?.platform ?? "Desktop"}</p>
          <div className="space-y-2">
            <h2 className="font-medium">Thư mục dữ liệu ứng dụng</h2>
            <p className="break-all text-muted-foreground">
              {info?.dataPath ?? "Đang đọc…"}
            </p>
          </div>
        </CardContent>
      </Card>
      <LauncherFooter />
    </div>
  );
}
