import { useCallback, useEffect, useState } from "react";
import {
  useQuery,
  useQueryClient,
} from "@gorth-com/primitive/cores/tanstack/query";
import type { GameCommand, GameSnapshot, GameVersion } from "@/utils/interface";
export function useGame() {
  const fallback: GameSnapshot = {
    directory: "",
    jobs: [],
    activeId: null,
    activeIds: [],
    downloadingId: null,
    queue: [],
    history: [],
  };
  const queryClient = useQueryClient();
  const key = ["desktop", "game", "snapshot"] as const;
  const snapshot = useQuery({
    queryKey: key,
    queryFn: () => window.electronAPI.game.snapshot(),
    retry: false,
    networkMode: "always",
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const catalog = useQuery({
    queryKey: ["desktop", "game", "versions"],
    queryFn: () => window.electronAPI.game.versions(),
    retry: false,
    networkMode: "always",
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const game = snapshot.data ?? fallback;
  const versions: GameVersion[] = catalog.data ?? [
    { id: "1.20.1", type: "release" },
  ];
  const setGame = useCallback(
    (value: GameSnapshot) => {
      void queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData(key, value);
    },
    [queryClient],
  );
  const [error, setError] = useState("");
  const ready = snapshot.isFetched;
  useEffect(() => {
    let alive = true;
    const accept = (value: GameSnapshot) => {
      if (alive) setGame(value);
    };
    const stop = window.electronAPI.game.onChanged(accept);
    return () => {
      alive = false;
      stop();
    };
  }, [setGame]);
  const run = useCallback(
    async (command: GameCommand) => {
      setError("");
      try {
        const result = await window.electronAPI.game.command(command);
        setGame(result.snapshot);
        if (!result.ok)
          setError(result.error ?? "Không xử lý được yêu cầu game.");
        return result.ok;
      } catch {
        setError("Không kết nối được dịch vụ game.");
        return false;
      }
    },
    [setGame],
  );
  const openDirectory = useCallback(async (id?: string) => {
    setError("");
    try {
      const result = await window.electronAPI.game.openDirectory(id);
      if (!result.ok)
        setError(result.error ?? "Không mở được thư mục Minecraft.");
    } catch {
      setError("Không kết nối được dịch vụ game.");
    }
  }, []);
  const exportLog = useCallback(async (id: string) => {
    setError("");
    try {
      const result = await window.electronAPI.game.exportLog(id);
      if (!result.ok) setError(result.error ?? "Không xuất được console.");
      return result.ok;
    } catch {
      setError("Không xuất được console.");
      return false;
    }
  }, []);
  return {
    refresh: async () => {
      try {
        const result = await catalog.refetch();
        if (result.error) throw result.error;
      } catch {
        setError("Không tải được danh sách phiên bản Minecraft.");
      }
    },
    game,
    versions,
    error: error || (snapshot.error ? "Không đọc được trạng thái game." : ""),
    run,
    openDirectory,
    exportLog,
    ready,
    clearError: () => setError(""),
  };
}
