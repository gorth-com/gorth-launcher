import {
  ArrowLeft,
  ArrowRight,
  PanelLeft,
  RefreshCw,
  Undo2,
} from "@gorth-io/primitive/cores/lucide";
import { Button } from "@gorth-io/primitive/custom/button";
import { Input } from "@gorth-io/primitive/default/input";

export interface NavigationBarProps {
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onBack: () => void;
  onForward?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  authUrl?: string;
  loading?: boolean;
  onReload?: () => void;
  canReload?: boolean;
}

export function NavigationBar({ ...props }: NavigationBarProps) {
  return (
    <header
      data-launcher-navigation
      className="[-webkit-app-region:drag] select-none flex h-14 shrink-0 items-center gap-2 border-b bg-sidebar p-2.5 [&_button]:[-webkit-app-region:no-drag]"
    >
      <NavigationControls {...props} />
    </header>
  );
}

export function NavigationControls({
  sidebarOpen,
  onToggleSidebar,
  onBack,
  onForward,
  canGoBack = true,
  canGoForward = false,
  authUrl,
  loading = false,
  onReload,
  canReload = true,
}: NavigationBarProps) {
  const BackIcon = authUrl !== undefined ? Undo2 : ArrowLeft;
  return (
    <>
      {onToggleSidebar && authUrl === undefined && (
        <Button
          size="icon"
          variant="ghost"
          className="size-9"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Ẩn sidebar" : "Hiện sidebar"}
          aria-expanded={sidebarOpen}
        >
          <PanelLeft />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="size-9"
        disabled={!canGoBack}
        onClick={onBack}
        aria-label={
          authUrl !== undefined ? "Quay lại trang hồ sơ Gorth" : "Quay lại"
        }
      >
        <BackIcon />
      </Button>
      {onForward && (
        <Button
          size="icon"
          variant="ghost"
          className="size-9"
          disabled={!canGoForward}
          onClick={onForward}
          aria-label="Tiến tới"
        >
          <ArrowRight />
        </Button>
      )}
      {authUrl !== undefined ? (
        <Input
          disabled
          className="[-webkit-app-region:no-drag] h-9 flex-1"
          aria-label="Địa chỉ xác thực"
          value={authUrl}
        />
      ) : (
        <div className="flex-1" />
      )}
      {onReload && (
        <Button
          size="icon"
          variant="ghost"
          className="size-9"
          disabled={!canReload}
          onClick={onReload}
          aria-label="Tải lại trang xác thực"
          aria-busy={loading}
        >
          <RefreshCw
            className={
              loading ? "animate-spin motion-reduce:animate-none" : undefined
            }
          />
        </Button>
      )}
    </>
  );
}
