import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OptionalModsTable } from "@/components/element/optional-mods-table";
import { LogViewer } from "@/components/element/log-viewer";

it("renders two columns with unchecked row checkboxes and a select-all checkbox", () => {
  const html = renderToStaticMarkup(
    <OptionalModsTable
      requestId="test"
      items={[
        { id: "a", name: "mods/a.jar" },
        { id: "b", name: "mods/b.jar" },
      ]}
      onCancel={() => {}}
    />,
  );
  expect(html.match(/data-slot="table-head"/g)).toHaveLength(2);
  expect(html.match(/data-slot="checkbox"/g)).toHaveLength(3);
  expect(html).not.toContain('aria-checked="true"');
  expect(html).toContain("Chọn tất cả mod tùy chọn");
  expect(html).toContain("mods/a.jar");
  expect(html).toContain("mods/b.jar");
});

it("renders current console text using a full-height CodeBlock inside ScrollArea", () => {
  const first = renderToStaticMarkup(
    <LogViewer content="Đang chuẩn bị…" fill />,
  );
  const next = renderToStaticMarkup(
    <LogViewer content={"Downloading a.jar\nDownloading b.jar"} fill />,
  );
  expect(first).toContain('data-slot="code-block"');
  expect(next).toContain("Downloading b.jar");
  expect(next).not.toContain("Đang chuẩn bị…");
  expect(next).toContain("h-full");
  expect(next).toContain('data-slot="scroll-area"');
  expect(next).toContain('data-slot="scroll-area-viewport"');
  expect(next).not.toContain("scrollbar-none");
  expect(next).not.toContain("[scrollbar-width:none]");
});
