import {
  cloneElement,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { PortalPanel } from "@/providers/portal";
// Menu items render in another native window. The default button has no
// main-document ResizeObserver/press-scale lifecycle crossing that boundary.
import { Button } from "@gorth-io/primitive/default/button";
interface DashboardMenuProps {
  label: string;
  trigger: ReactElement<{
    onClick?: () => void;
    "aria-label"?: string;
    "aria-expanded"?: boolean;
    "aria-haspopup"?: "menu";
  }>;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
}
export function DashboardMenu({
  label,
  trigger,
  children,
  align = "end",
}: DashboardMenuProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <div ref={anchor} className="w-full">
      {cloneElement(trigger, {
        onClick: () => setOpen(!open),
        "aria-label": label,
        "aria-expanded": open,
        "aria-haspopup": "menu",
      })}
      {open && (
        <PortalPanel
          anchor={
            anchor.current?.getBoundingClientRect() ?? {
              x: 0,
              y: 0,
              width: 0,
              height: 0,
            }
          }
          align={align}
          className="w-64"
          onClose={() => setOpen(false)}
        >
          {children(() => setOpen(false))}
        </PortalPanel>
      )}
    </div>
  );
}
export function DashboardMenuItem({
  className = "",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      role="menuitem"
      className={`h-9 w-full justify-start gap-2 text-left [&>svg]:size-4 ${className}`}
      {...props}
    />
  );
}
