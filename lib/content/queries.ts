import { queryOptions } from "@gorth-com/primitive/cores/tanstack/query";
import type { ContentQuery } from "./interface";

export function contentSearchOptions(
  query: ContentQuery | null,
  instanceId: string,
) {
  return queryOptions({
    queryKey: ["desktop", "content", "search", instanceId, query] as const,
    enabled: query !== null,
    queryFn: async ({ signal }) => {
      if (!query) throw new Error("Chưa có bộ lọc tìm kiếm.");
      const result = await window.electronAPI.content.search(query);
      signal.throwIfAborted();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    retry: false,
    networkMode: "always",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function contentVersionsOptions(
  query: ContentQuery | null,
  projectId: string | undefined,
  instanceId: string,
) {
  return queryOptions({
    queryKey: [
      "desktop",
      "content",
      "versions",
      instanceId,
      query,
      projectId,
    ] as const,
    enabled: query !== null && projectId !== undefined,
    queryFn: async ({ signal }) => {
      if (!query || !projectId) throw new Error("Chưa chọn project.");
      const result = await window.electronAPI.content.versions(
        query,
        projectId,
      );
      signal.throwIfAborted();
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    retry: false,
    networkMode: "always",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
