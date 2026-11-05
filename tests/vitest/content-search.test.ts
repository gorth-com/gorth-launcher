import { beforeEach, expect, it, vi } from "vitest";
import { loaderCatalog } from "@/utils/constant";
import { querySchema } from "@/lib/content/schema";
import { searchContent } from "@/lib/content/providers";
import { fetcher } from "@/utils/fetcher";

vi.mock("@/utils/fetcher", () => ({ fetcher: vi.fn() }));
vi.mock("@/utils/environment", () => ({ curseforgeApiKey: "test-key" }));
beforeEach(() => vi.mocked(fetcher).mockReset());

const query = {
  provider: "modrinth" as const,
  kind: "mod" as const,
  query: "Sodium",
  version: loaderCatalog[0].minecraft,
  loader: loaderCatalog[0].loader,
  offset: 0,
};

it("validates bounded page sizes and sort options at the IPC boundary", () => {
  for (const limit of [10, 20, 50])
    expect(
      querySchema.safeParse({ ...query, limit, sort: "updated" }).success,
    ).toBe(true);
  for (const limit of [0, 21, 100, -1])
    expect(querySchema.safeParse({ ...query, limit }).success).toBe(false);
  expect(querySchema.safeParse({ ...query, sort: "untrusted" }).success).toBe(
    false,
  );
  expect(querySchema.safeParse(query).success).toBe(true);
});

it("forwards Modrinth pagination/sort and maps real card metadata", async () => {
  vi.mocked(fetcher).mockResolvedValueOnce({
    data: {
      hits: [
        {
          project_id: "sodium",
          title: "Sodium",
          description: "Performance",
          downloads: 42,
          icon_url: "https://cdn.modrinth.com/icon.png",
          author: "Author",
          display_categories: ["optimization"],
          date_modified: "2026-10-01T00:00:00Z",
        },
      ],
      total_hits: 60,
    },
  } as never);
  const result = await searchContent(
    { ...query, limit: 10, offset: 10, sort: "updated" },
    new AbortController().signal,
  );
  const params = new URL(vi.mocked(fetcher).mock.calls[0][0].url!).searchParams;
  expect(params.get("limit")).toBe("10");
  expect(params.get("offset")).toBe("10");
  expect(params.get("index")).toBe("updated");
  expect(result.more).toBe(true);
  expect(result.projects[0]).toMatchObject({
    author: "Author",
    categories: ["optimization"],
    iconUrl: "https://cdn.modrinth.com/icon.png",
  });
});

it("forwards CurseForge paging and uses provider author/logo metadata", async () => {
  vi.mocked(fetcher).mockResolvedValueOnce({
    data: {
      data: [
        {
          id: 123,
          name: "Mod",
          summary: "Summary",
          downloadCount: 50,
          authors: [{ name: "Creator" }],
          logo: { thumbnailUrl: "https://media.forgecdn.net/icon.png" },
          categories: [{ name: "Magic" }],
        },
      ],
      pagination: { totalCount: 51 },
    },
  } as never);
  const result = await searchContent(
    {
      ...query,
      provider: "curseforge",
      limit: 50,
      offset: 50,
      sort: "downloads",
    },
    new AbortController().signal,
  );
  const params = new URL(vi.mocked(fetcher).mock.calls[0][0].url!).searchParams;
  expect(params.get("pageSize")).toBe("50");
  expect(params.get("index")).toBe("50");
  expect(params.get("sortField")).toBe("6");
  expect(result.more).toBe(false);
  expect(result.projects[0]).toMatchObject({
    author: "Creator",
    categories: ["Magic"],
  });
});
