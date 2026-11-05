import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { defaultSettings, instanceCreateSections } from "@/utils/constant";
vi.mock("@/layouts/instance-workspace", () => ({
  InstanceWorkspace: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/pages/content", () => ({ ContentPage: () => null }));
import { CreateInstancePage } from "@/pages/instances/create";

function render(
  overrides: Partial<ComponentProps<typeof CreateInstancePage>> = {},
) {
  return renderToStaticMarkup(
    <CreateInstancePage
      settings={defaultSettings}
      navigation={{ onBack: vi.fn() }}
      onBack={vi.fn()}
      onNavigate={vi.fn()}
      instances={[]}
      versions={[{ id: "1.20.1", type: "release" }]}
      busy={false}
      onCreate={vi.fn(async () => true)}
      onRefreshVersions={vi.fn()}
      {...overrides}
    />,
  );
}
it("places version and loader cards left-to-right in a 2:1 grid with gap-6", () => {
  const html = render();
  expect(html).toContain("grid grid-cols-1 items-start gap-6 md:grid-cols-3");
  expect(html).toMatch(/<div[^>]*md:col-span-2[^>]*>[\s\S]*?Minecraft version/);
  expect(html.indexOf("Minecraft version")).toBeLessThan(
    html.indexOf("Mod loader"),
  );
  expect(html).not.toMatch(/space-[xy]-/);
});
it("initially shows only 26, 1.21 and 1.20 families with expansion in the card footer", () => {
  const html = render({
    versions: ["26.1", "26.2", "1.21.11", "1.20.6", "1.19.4", "1.18.2"].map(
      (id) => ({ id, type: "release" }),
    ),
  });
  for (const id of ["26.1", "26.2", "1.21.11", "1.20.6"])
    expect(html).toContain(`value="${id}"`);
  for (const id of ["1.19.4", "1.18.2"])
    expect(html).not.toContain(`value="${id}"`);
  expect(html).toMatch(/data-slot="card-footer"[\s\S]*?Show more/);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Hide less<\/button>/);
  expect(html).toContain("scroll-fade scrollbar-none overflow-y-auto");
  expect(html).toContain("justify-end gap-2");
});
it("moves both actions into the heading and associates Create with the original form", () => {
  const html = render();
  const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? "";
  const formId = html.match(/<form[^>]*\bid="([^"]+)"/)?.[1];
  expect(formId).toBeTruthy();
  expect(header).toContain("justify-between");
  expect(header).toContain("Cancel");
  expect(header).toContain("Import instance");
  expect(
    instanceCreateSections.some((item) => String(item.id) === "import"),
  ).toBe(false);
  expect(header).toContain("Create instance");
  expect(header).toContain(`form="${formId}"`);
  expect(header).toContain('type="submit"');
  expect(html.match(/Create instance/g)).toHaveLength(1);
  expect(html).toMatch(/<input[^>]*required/);
});
it("keeps the header actions disabled while busy and prevents creation without versions", () => {
  const header = render({ busy: true }).split("</header>")[0];
  expect(header.match(/<button\b[^>]*\sdisabled=""/g)).toHaveLength(3);
  const empty = render({ versions: [] }).split("</header>")[0];
  expect(empty.match(/<button\b[^>]*\sdisabled=""/g)).toHaveLength(1);
});
