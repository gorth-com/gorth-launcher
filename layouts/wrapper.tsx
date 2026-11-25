import type { ReactNode } from "react";
import { cn } from "@gorth-com/primitive/cores/cn";

function Wrapper({
  children,
  fullWidth = false,
  immersive = false,
  fill = false,
}: {
  children: ReactNode;
  fullWidth?: boolean;
  immersive?: boolean;
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1",
        fullWidth ? "w-full" : "container",
        immersive ? "flex h-full flex-col p-0" : "mx-auto p-6",
        fill && "flex h-full min-h-0 flex-col",
      )}
    >
      {children}
    </div>
  );
}

export { Wrapper };
