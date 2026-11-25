import { Bookmark, PanelLeftClose } from "@gorth-com/primitive/cores/lucide";

import { Button } from "@gorth-com/primitive/custom/button";
import { ScrollArea } from "@gorth-com/primitive/default/scroll-area";
import { Separator } from "@gorth-com/primitive/default/separator";

interface BrowserBookmark {
  id: string;
  title: string;
  url: string;
}

type BrowserSidebarSide = "left" | "right";

interface BrowserSidebarProps {
  bookmarks: BrowserBookmark[];
  onClose: () => void;
  onNavigate: (url: string) => void;
}

function BrowserSidebar({
  bookmarks,
  onClose,
  onNavigate,
}: BrowserSidebarProps) {
  return (
    <aside className="relative z-40 flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-12 items-center justify-between px-3">
        <span className="text-sm font-semibold">Bookmarks</span>
        <Button
          aria-label="Close sidebar"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <PanelLeftClose />
        </Button>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1 p-2">
        {bookmarks.length ? (
          <div className="space-y-1">
            {bookmarks.map((bookmark) => (
              <Button
                className="h-auto w-full justify-start gap-2 px-2 py-2 text-left"
                key={bookmark.id}
                onClick={() => onNavigate(bookmark.url)}
                variant="ghost"
              >
                <Bookmark className="size-4 fill-current" />
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    {bookmark.title}
                  </span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {bookmark.url}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        ) : (
          <p className="px-2 py-6 text-center text-xs leading-5 text-muted-foreground">
            No bookmarks yet. Select the star beside the address bar to add one.
          </p>
        )}
      </ScrollArea>
    </aside>
  );
}

export { BrowserSidebar };
export type { BrowserBookmark, BrowserSidebarSide };
