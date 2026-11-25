import { afterEach, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryObserver,
  onlineManager,
} from "@gorth-com/primitive/cores/tanstack/query";
import {
  contentSearchOptions,
  contentVersionsOptions,
} from "@/lib/content/queries";
import type { ContentQuery } from "@/lib/content/interface";

const query: ContentQuery = {
  provider: "curseforge",
  kind: "mod",
  query: "test",
  version: "1.20.1",
  loader: "Forge",
  offset: 0,
  limit: 20,
  sort: "relevance",
};
const clients: QueryClient[] = [];
function client() {
  const value = new QueryClient();
  clients.push(value);
  return value;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});

it("keys search by provider, content, runtime, pagination, sort and instance", () => {
  const original = contentSearchOptions(query, "one").queryKey;
  for (const change of [
    { provider: "modrinth" },
    { kind: "shader" },
    { query: "other" },
    { loader: "Fabric" },
    { version: "1.21.1" },
    { offset: 20 },
    { limit: 50 },
    { sort: "updated" },
  ])
    expect(
      contentSearchOptions({ ...query, ...change } as ContentQuery, "one")
        .queryKey,
    ).not.toEqual(original);
  expect(contentSearchOptions(query, "two").queryKey).not.toEqual(original);
  expect(
    contentVersionsOptions(query, "project-two", "one").queryKey,
  ).not.toEqual(contentVersionsOptions(query, "project-one", "one").queryKey);
});

it("a delayed response for an old target cannot replace the current search", async () => {
  const old = deferred<{ ok: true; data: { projects: []; more: boolean } }>();
  const search = vi
    .fn()
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ ok: true, data: { projects: [], more: true } });
  vi.stubGlobal("window", { electronAPI: { content: { search } } });
  const observer = new QueryObserver(
    client(),
    contentSearchOptions(query, "one"),
  );
  const stop = observer.subscribe(() => {});
  observer.setOptions(
    contentSearchOptions({ ...query, version: "1.21.1" }, "two"),
  );
  await vi.waitFor(() =>
    expect(observer.getCurrentResult().data?.more).toBe(true),
  );
  old.resolve({ ok: true, data: { projects: [], more: false } });
  await Promise.resolve();
  expect(observer.getCurrentResult().data?.more).toBe(true);
  expect(search).toHaveBeenCalledTimes(2);
  stop();
});

it("a delayed project version response cannot replace the new project", async () => {
  const old = deferred<unknown>();
  const versions = vi
    .fn()
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({ ok: true, data: [{ id: "new-version" }] });
  vi.stubGlobal("window", { electronAPI: { content: { versions } } });
  const observer = new QueryObserver(
    client(),
    contentVersionsOptions(query, "old", "one"),
  );
  const stop = observer.subscribe(() => {});
  observer.setOptions(contentVersionsOptions(query, "new", "one"));
  await vi.waitFor(() =>
    expect(observer.getCurrentResult().data?.[0].id).toBe("new-version"),
  );
  old.resolve({ ok: true, data: [{ id: "old-version" }] });
  await Promise.resolve();
  expect(observer.getCurrentResult().data?.[0].id).toBe("new-version");
  stop();
});

it("does not silently retry failed IPC requests, including offline", async () => {
  onlineManager.setOnline(false);
  const search = vi
    .fn()
    .mockResolvedValue({ ok: false, error: "provider unavailable" });
  vi.stubGlobal("window", { electronAPI: { content: { search } } });
  await expect(
    client().fetchQuery(contentSearchOptions(query, "one")),
  ).rejects.toThrow("provider unavailable");
  expect(search).toHaveBeenCalledTimes(1);
});
