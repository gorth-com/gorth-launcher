import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("application sidebar border contract", () => {
  it("composes published Sidebar primitives with an SSO-sized header and account footer", async () => {
    const source = await readFile(
      new URL("../../layouts/dashboard.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('"@gorth-com/primitive/custom/sidebar"');
    expect(source).not.toContain("@/components/dashboard/app-sidebar");
    expect(source).toContain("<SidebarHeader");
    expect(source).toContain('size="lg"');
    expect(source).toContain("h-14");
    expect(source).toContain("size-9");
    expect(source).toContain("text-2xl font-bold");
    expect(source).toMatch(
      /<SidebarFooter[\s\S]*<NavUser[\s\S]*<\/SidebarFooter>/,
    );
    expect(source).toContain("onClick=");
    expect(source).not.toContain("next/link");
  });
  it("keeps identity rendering in Primitive and menu rendering in the native portal", async () => {
    const nav = await readFile(
      new URL("../../components/dashboard/nav-user.tsx", import.meta.url),
      "utf8",
    );
    const menu = await readFile(
      new URL("../../components/dashboard/menu.tsx", import.meta.url),
      "utf8",
    );
    expect(nav).toContain('"@/components/dashboard/nav-identity"');
    expect(nav).not.toContain('"@gorth-com/primitive/dashboard/');
    expect(nav).toContain("<NavAccount");
    expect(nav).toContain("<NavIdentity");
    expect(nav).toContain("<DashboardMenu");
    expect(nav).not.toContain("AvatarFallback");
    expect(menu).toContain("<PortalPanel");
    expect(menu).toContain('"@gorth-com/primitive/default/button"');
  });
});
