import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Settings } from "@gorth-io/primitive/cores/lucide";
import { expect, it } from "vitest";
import { PageHeading, HeadingIcon } from "@/components/heading";

it("uses the requested heading typography without inventing an icon", () => {
  const html = renderToStaticMarkup(
    createElement(PageHeading, { title: "Get started" }),
  );
  expect(html).toContain("text-3xl font-semibold tracking-tight text-foreground");
  expect(html).not.toContain("<svg");
});
it("renders optional icon, description and actions", () => {
  const html = renderToStaticMarkup(
    createElement(PageHeading, {
      title: "Settings",
      icon: Settings,
      description: "Preferences",
      actions: createElement("button", null, "Reset"),
    }),
  );
  expect(html).toContain("Preferences");
  expect(html).toContain("Reset");
  expect(html).toContain(
    "size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground",
  );
  expect(html).toMatch(/<svg[^>]*class="[^"]*\bsize-4\b[^"]*"/);
});
it("shares the same noninteractive icon presentation with sidebar headers", () => {
  const html = renderToStaticMarkup(
    createElement(HeadingIcon, { icon: Settings }),
  );
  expect(html).toContain('aria-hidden="true"');
  expect(html).not.toContain("<button");
});
