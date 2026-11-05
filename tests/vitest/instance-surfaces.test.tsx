import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { HomePage } from "@/pages/home";
import { LibraryPage } from "@/pages/instances";
import { InstanceCards } from "@/components/element/instance-cards";
import { ContentProjectCard } from "@/components/element/content-project-card";
import { DownloadsPage } from "@/pages/downloads";
import { ConsolePage } from "@/pages/console";
import { LogViewer } from "@/components/element/log-viewer";
import { instanceToolDestination } from "@/lib/navigation";
import { navigation } from "@/utils/constant";
import type { Instance } from "@/utils/interface";
import type { useGame } from "@/hooks/use-game";

const instances: Instance[] = [
  {
    id: "one",
    name: "First",
    version: "1.20.1",
    loader: "Vanilla",
    createdAt: 1,
  },
  {
    id: "two",
    name: "Second",
    version: "1.21.1",
    loader: "Fabric",
    createdAt: 2,
  },
];
const gaming = {
  game: {
    directory: "/fixture",
    jobs: [
      {
        instanceId: "one",
        phase: "crashed",
        version: "1.20.1",
        message: "PRIVATE ERROR DETAIL",
        logs: ["PRIVATE LOG"],
        total: 5,
        completed: 2,
        speed: 0,
        eta: null,
        queuePosition: null,
      },
    ],
    history: [
      {
        id: "session",
        instanceId: "one",
        startedAt: 1,
        duration: 50,
        crashed: false,
      },
      {
        id: "session-2",
        instanceId: "one",
        startedAt: 2,
        duration: 10,
        crashed: false,
      },
    ],
    activeIds: [],
    activeId: null,
    downloadingId: null,
    queue: [],
  },
  run: vi.fn(),
  openDirectory: vi.fn(),
  exportLog: vi.fn(),
} as unknown as ReturnType<typeof useGame>;

it("renders the chosen instance icon instead of a fallback image", () => {
  const html = renderToStaticMarkup(
    <InstanceCards
      items={[{ ...instances[0], iconData: "lucide:rocket" }]}
      onSelect={vi.fn()}
      statusLabel={() => "Ready"}
    />,
  );
  expect(html).not.toContain("<img");
  expect(html).toContain("lucide-rocket");
  expect(html).toMatch(/class="[^"]*lucide-rocket[^"]*\bsize-16\b/);
});

it("aligns instance and pack card metadata after their top actions", () => {
  const instance = renderToStaticMarkup(
    <InstanceCards
      items={instances}
      layout="list"
      onSelect={vi.fn()}
      onPlay={vi.fn()}
      statusLabel={() => "Ready"}
      playTimeLabel={() => "2 hours"}
    />,
  );
  const pack = renderToStaticMarkup(
    <ContentProjectCard
      project={{
        id: "pack",
        url: "https://modrinth.com/mod/pack",
        name: "Pack",
        description: "Description",
        downloads: 42,
        publishedAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
      }}
      query={{
        provider: "modrinth",
        kind: "mod",
        query: "",
        version: "1.20.1",
        loader: "Forge",
        offset: 0,
      }}
      layout="list"
      busy={false}
      onOpen={vi.fn()}
      onInstall={vi.fn()}
    />,
  );
  for (const html of [instance, pack]) {
    expect(html).toContain("p-4");
    expect(html).toContain("gap-4");
    expect(html).toContain("mt-auto flex flex-wrap items-center gap-2");
    expect(html.lastIndexOf('data-slot="badge"')).toBeGreaterThan(
      html.indexOf("</button>"),
    );
  }
  expect(instance).toContain("2 hours");
  expect(pack).toContain('title="Published"');
  expect(pack).toContain(">Forge<");
  expect(pack).toContain(">1.20.1<");
});

it("keeps only quick play and unique recently played instances on Home", () => {
  const html = renderToStaticMarkup(
    <HomePage
      instances={instances}
      game={gaming.game}
      accounts={[]}
      accountId={null}
      onCreate={vi.fn()}
      onOpenLibrary={vi.fn()}
      onSelect={vi.fn()}
      onPlay={vi.fn()}
      onStop={vi.fn()}
      onAccount={vi.fn()}
      selectedInstanceId="two"
      onInstanceChange={vi.fn()}
    />,
  );
  expect(html).toContain("Recently played");
  expect(html.match(/>Select<\/button>/g)).toHaveLength(1);
  expect(html).not.toMatch(
    /Total Launches|System Memory|Active Profile|Recent Activity|Last Played Profiles|<aside/,
  );
  expect(html).toMatch(/<option[^>]*value="two"[^>]*selected=""/);
});

it("shows the full instance list only once without a secondary selector", () => {
  const html = renderToStaticMarkup(
    <LibraryPage
      instances={instances}
      query=""
      filter="all"
      onQueryChange={vi.fn()}
      onFilterChange={vi.fn()}
      onCreate={vi.fn()}
      onSelect={vi.fn()}
      statusLabel={() => "Ready"}
    />,
  );
  expect(html.match(/data-slot="card"/g)).toHaveLength(2);
  expect(html.match(/Play now/g)).toHaveLength(2);
  expect(html).toContain('aria-label="Chi tiết First"');
  expect(html).toContain('aria-label="Chi tiết Second"');
  expect(html).toContain('role="search"');
  expect(html).toContain("Tất cả mod loader (2)");
  expect(html).toContain("Nhập instance mồ côi");
  expect(html).toContain('type="submit"');
  expect(html).toContain('aria-label="Instance layout"');
  expect(html).not.toContain("Quản lý các cấu hình Minecraft độc lập");
  expect(navigation.some((item) => item.id === "pack")).toBe(true);
  expect(
    navigation.some((item) =>
      ["mods", "resourcepacks", "shaders"].includes(item.id),
    ),
  ).toBe(false);
  expect(html).not.toMatch(
    /Instance settings preview|Export &amp; Manage|<aside/,
  );
});

it("keeps Downloads limited to task status/progress with destinations instead of log/history copies", () => {
  const html = renderToStaticMarkup(
    <DownloadsPage
      {...gaming}
      instances={instances}
      onConsole={vi.fn()}
      onHistory={vi.fn()}
    />,
  );
  expect(html).toContain("<progress");
  expect(html).toContain("Console");
  expect(html).toContain("History");
  expect(html).not.toMatch(
    /PRIVATE LOG|PRIVATE ERROR DETAIL|<pre|Lịch sử chơi|session-2/,
  );
});

it("does not leak another job's logs when a selected instance has no job", () => {
  const html = renderToStaticMarkup(
    <ConsolePage
      {...gaming}
      instances={instances}
      selectedInstanceId="two"
      fixedInstance
    />,
  );
  expect(html).toContain("Chưa có log phù hợp.");
  expect(html).not.toContain("PRIVATE LOG");
  expect(html).not.toContain('aria-label="Instance console"');
});

it("uses the default CodeBlock with plain, escaped streaming output and 13px semibold typography", () => {
  const html = renderToStaticMarkup(
    <LogViewer content={'<script>alert("x")</script>\n\nnext'} />,
  );
  expect(html).toContain('data-slot="code-block"');
  expect(html).toContain('data-slot="code-block-content"');
  expect(html).toContain("text-[13px]");
  expect(html).toContain("font-semibold");
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("\n\nnext");
  const font = readFileSync(
    new URL(
      "../../public/fonts/jetbrains-mono/JetBrainsMono-SemiBold.woff2",
      import.meta.url,
    ),
  );
  expect(font.subarray(0, 4).toString()).toBe("wOF2");
});

it("removes redundant destinations from navigation while preserving legacy links into the selected editor", () => {
  expect(navigation.map((item) => item.id)).not.toContain("gallery");
  expect(navigation.map((item) => item.id)).not.toContain("instances/data");
  expect(instanceToolDestination("gallery", "two")).toEqual({
    page: "instances/edit/two",
    section: "screenshots",
  });
  expect(instanceToolDestination("instances/data", "two")).toEqual({
    page: "instances/edit/two",
    section: "notes",
  });
  expect(instanceToolDestination("gallery", "")).toEqual({ page: "instances" });
  expect(instanceToolDestination("home", "two")).toBeUndefined();
});
