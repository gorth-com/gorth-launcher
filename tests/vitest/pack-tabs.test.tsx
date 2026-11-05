import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/pages/content", () => ({
  ContentPage: ({
    fixedKind,
    catalogTabs,
  }: {
    fixedKind: string;
    catalogTabs: ReactNode;
  }) => <div data-kind={fixedKind}>{catalogTabs}</div>,
}));
import { PackPage } from "@/pages/pack";

it("opens Data Packs using the shared datapack search/install page", () => {
  const html = renderToStaticMarkup(
    <PackPage
      initialKind="datapack"
      instances={[]}
      gameBusy={false}
      hideWebview={false}
      onLibrary={vi.fn()}
      onDetailChange={vi.fn()}
    />,
  );
  expect(html).toContain('data-kind="datapack"');
  for (const title of [
    "Mods",
    "Resource Packs",
    "Shader Packs",
    "Data Packs",
    "Worlds",
  ])
    expect(html).toContain(title);
  expect(html).toContain("grid-cols-5");
  expect(html).toContain("max-w-[916px]");
  expect(html).not.toContain("flex-wrap");
});
