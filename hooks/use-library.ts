import { defaultSettings } from "@/utils/constant";
import { useEffect, useRef, useState } from "react";
import { useTRPC, useTRPCClient } from "@/lib/rpc/client";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@gorth-com/primitive/cores/tanstack/query";
import type {
  LibraryCommand,
  LibrarySnapshot,
  Settings,
} from "@/utils/interface";
import { readInstances, readSettings } from "@/utils/launcher";

export function useLibrary() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();
  const key = trpc.library.snapshot.queryKey();
  const [error, setError] = useState("");
  const pendingSettings = useRef<Settings | null>(null);
  const confirmedSettings = useRef(defaultSettings);
  const migration = useRef<ReturnType<
    typeof window.electronAPI.library.command
  > | null>(null);
  const revision = useRef(0);
  const accept = (snapshot: LibrarySnapshot) => {
    revision.current++;
    confirmedSettings.current = snapshot.settings;
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData(key, {
      ...snapshot,
      settings: pendingSettings.current ?? snapshot.settings,
    });
  };
  const snapshot = useQuery({
    ...trpc.library.snapshot.queryOptions(),
    queryFn: async () => {
      const started = revision.current;
      migration.current ??= window.electronAPI.library.command({
        action: "migrate",
        instances: readInstances(),
        settings: readSettings(),
      });
      const migrated = await migration.current;
      if (!migrated.ok) {
        setError(migrated.error ?? "Không chuyển được dữ liệu cũ.");
        return migrated.snapshot;
      }
      const value = await client.library.snapshot.query();
      if (started !== revision.current)
        return queryClient.getQueryData<LibrarySnapshot>(key) ?? value;
      confirmedSettings.current = value.settings;
      return { ...value, settings: pendingSettings.current ?? value.settings };
    },
    retry: false,
    staleTime: Infinity,
    networkMode: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => window.electronAPI.library.onChanged(accept), [queryClient]);
  const settingsMutation = useMutation({
    ...trpc.library.settings.mutationOptions(),
    // Query serializes writes; keep later optimistic settings visible meanwhile.
    scope: { id: "library-settings" },
    networkMode: "always",
    retry: false,
    onSuccess: (result, settings) => {
      if (pendingSettings.current === settings) pendingSettings.current = null;
      accept(result.snapshot);
      if (!result.ok) setError(result.error ?? "Không cập nhật được thư viện.");
    },
    onError: (_error, settings) => {
      if (pendingSettings.current === settings) {
        pendingSettings.current = null;
        queryClient.setQueryData<LibrarySnapshot>(key, (value) =>
          value
            ? {
                ...value,
                settings: confirmedSettings.current,
              }
            : value,
        );
      }
      setError("Không kết nối được database launcher.");
    },
  });
  const commandMutation = useMutation({
    mutationFn: (command: LibraryCommand) =>
      window.electronAPI.library.command(command),
    networkMode: "always",
    retry: false,
    onSuccess: (result) => {
      accept(result.snapshot);
      if (!result.ok) setError(result.error ?? "Không cập nhật được thư viện.");
    },
    onError: () => setError("Không kết nối được database launcher."),
  });
  async function run(command: LibraryCommand) {
    setError("");
    try {
      const result =
        command.action === "settings"
          ? await settingsMutation.mutateAsync(command.settings)
          : await commandMutation.mutateAsync(command);
      return result.ok;
    } catch {
      return false;
    }
  }
  function setSettings(value: Settings | ((current: Settings) => Settings)) {
    const current =
      queryClient.getQueryData<LibrarySnapshot>(key)?.settings ??
      defaultSettings;
    const next = typeof value === "function" ? value(current) : value;
    pendingSettings.current = next;
    queryClient.setQueryData<LibrarySnapshot>(key, (snapshot) =>
      snapshot
        ? {
            ...snapshot,
            settings: next,
          }
        : snapshot,
    );
    void run({ action: "settings", settings: next });
  }
  return {
    ...(snapshot.data ?? {
      instances: [],
      settings: defaultSettings,
      instanceSettings: {},
      trash: [],
    }),
    ready: snapshot.isFetched,
    busy: commandMutation.isPending,
    error: error || (snapshot.error ? "Không đọc được database launcher." : ""),
    run,
    setSettings,
    clearError: () => setError(""),
  };
}
