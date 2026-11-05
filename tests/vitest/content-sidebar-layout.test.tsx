import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { navigation } from "@/utils/constant";

vi.mock("@/hooks/use-feedback-toast", () => ({ useFeedbackToast: vi.fn() }));
import { ContentPage } from "@/pages/content";

function render(catalogMode: boolean) {
  return renderToStaticMarkup(
    <ContentPage
      instances={[]}
      gameBusy={false}
      onLibrary={vi.fn()}
      hideWebview={false}
      onDetailChange={vi.fn()}
      fixedKind={catalogMode ? "mod" : "modpack"}
      catalogMode={catalogMode}
      catalogTabs={<span>Catalog tabs</span>}
      initialProvider="curseforge"
    />,
  );
}

it("places Pack search between its heading and Filters in the right sidebar", () => {
  const html = render(true);
  const aside = html.match(/<aside\b[\s\S]*?<\/aside>/)?.[0] ?? "";
  expect(aside).toContain('role="search"');
  expect(aside.indexOf("Pack")).toBeLessThan(aside.indexOf('role="search"'));
  expect(aside.indexOf('role="search"')).toBeLessThan(
    aside.indexOf('aria-label="Filters"'),
  );
  expect(aside).not.toContain("Catalog tabs");
});

it("keeps modpack catalog controls on the left and omits the redundant import action", () => {
  const html = render(false);
  const aside = html.match(/<aside\b[\s\S]*?<\/aside>/)?.[0] ?? "";
  expect(html).not.toContain("Nhập .mrpack / .zip");
  expect(aside.indexOf('role="search"')).toBeGreaterThan(-1);
  expect(aside.indexOf('role="search"')).toBeLessThan(
    aside.indexOf('data-slot="card"'),
  );
  expect(aside).not.toContain('aria-label="Sort projects"');
  expect(aside).not.toContain('aria-label="Items per page"');
  expect(aside).not.toContain('aria-label="Project layout"');
  expect(aside).not.toContain('aria-label="Project pages"');
  expect(html).toContain('aria-label="Catalog controls"');
  expect(html).toContain('aria-label="Project pages"');
  expect(navigation.some((item) => item.id === "content")).toBe(false);
});
