import {
  CodeBlock,
  CodeBlockContent,
} from "@gorth-io/primitive/default/code-block";
import { cn } from "@gorth-io/primitive/cores/cn";

export function LogViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <CodeBlock>
      <CodeBlockContent
        wrap
        className={cn(
          "max-h-96 font-mono text-[13px] font-semibold",
          className,
        )}
      >
        {content}
      </CodeBlockContent>
    </CodeBlock>
  );
}
