import { Box } from "@gorth-com/primitive/cores/lucide";
import { useFullScreen } from "@/hooks/use-full-screen";
import { cn } from "@gorth-com/primitive/cores/cn";
import {
  NavigationControls,
  type NavigationBarProps,
} from "@/layouts/navigation-bar";

interface TitlebarProps {
  showLogo: boolean;
  navigation?: NavigationBarProps;
}

export function Titlebar({ showLogo, navigation }: TitlebarProps) {
  const isFullScreen = useFullScreen();
  return (
    <header
      data-launcher-titlebar
      className="[-webkit-app-region:drag] select-none relative z-50 flex h-14 shrink-0 items-center border-b bg-sidebar backdrop-blur-xl"
    >
      <div
        aria-hidden="true"
        className={cn(
          "h-full shrink-0 transition-[width] duration-200",
          window.electronAPI.windowState.isMacOS && !isFullScreen
            ? "w-24 border-r"
            : "w-0",
        )}
      />
      <div className="flex min-w-0 flex-1 items-center gap-2 p-2.5 [&_button]:[-webkit-app-region:no-drag]">
        {showLogo && (
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center p-2.5 text-foreground"
          >
            <Box className="size-4 shrink-0" />
          </span>
        )}
        {navigation && <NavigationControls {...navigation} />}
      </div>
      {!window.electronAPI.windowState.isMacOS && (
        <div className="ml-auto w-36 shrink-0 bg-slate-700" />
      )}
    </header>
  );
}
