import {
  CodeBlock,
  CodeBlockContent,
} from "@gorth-io/primitive/default/code-block";
import { cn } from "@gorth-io/primitive/cores/cn";
import { ScrollArea, ScrollBar } from "@gorth-io/primitive/default/scroll-area";

export function LogViewer({
  content,
  className,
  fill = false,
}: {
  content: string;
  className?: string;
  fill?: boolean;
}) {
  const Container = fill ? ScrollArea : "div";
  return (
    <CodeBlock className={cn(fill && "h-full min-h-0 flex-1")}>
      <Container className={cn(fill && "h-full min-h-0 flex-1")}>
        <CodeBlockContent
          wrap
          className={cn(
            "max-h-96 font-mono text-[13px] font-semibold",
            fill && "max-h-none min-h-full overflow-visible",
            className,
          )}
        >
          {content}
        </CodeBlockContent>
        {fill && <ScrollBar orientation="horizontal" />}
      </Container>
    </CodeBlock>
  );
}
