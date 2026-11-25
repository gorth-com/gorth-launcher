import {
  CodeBlock,
  CodeBlockContent,
} from "@gorth-com/primitive/default/code-block";
import { cn } from "@gorth-com/primitive/cores/cn";
import {
  ScrollArea,
  ScrollBar,
} from "@gorth-com/primitive/default/scroll-area";
import type { Ref } from "react";

export function LogViewer({
  content,
  className,
  fill = false,
  wrap = true,
  color = false,
  activeLine,
  scrollRef,
}: {
  content: string;
  className?: string;
  fill?: boolean;
  wrap?: boolean;
  color?: boolean;
  activeLine?: number;
  scrollRef?: Ref<HTMLDivElement>;
}) {
  return (
    <CodeBlock className={cn("min-h-0", fill ? "h-full flex-1" : "h-96")}>
      <ScrollArea ref={scrollRef} className="h-full min-h-0 flex-1">
        <CodeBlockContent
          wrap={wrap}
          className={cn(
            "min-h-full max-h-none overflow-visible font-mono text-[13px] font-semibold",
            className,
          )}
        >
          {color || activeLine !== undefined
            ? content.split("\n").map((line, index) => (
                <span
                  key={index}
                  data-log-line={index}
                  className={cn(
                    "block min-h-lh",
                    color &&
                      /\b(error|fatal|exception)\b/i.test(line) &&
                      "text-destructive",
                    color && /\bdebug\b/i.test(line) && "text-muted-foreground",
                    activeLine === index && "bg-accent text-accent-foreground",
                  )}
                >
                  {line || " "}
                </span>
              ))
            : content}
        </CodeBlockContent>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </CodeBlock>
  );
}
