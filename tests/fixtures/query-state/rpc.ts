/* oxlint-disable typescript/no-explicit-any -- Test-only dynamic transport; no native or production API is exposed. */
// Only the transport is mocked; the hooks use real React Query observers/mutations.
const key = ["fixture", "library"] as const;
export function useTRPC() {
  return {
    library: {
      snapshot: {
        queryKey: () => key,
        queryOptions: () => ({ queryKey: key }),
      },
      settings: {
        mutationOptions: () => ({
          mutationFn: (settings: unknown) =>
            (window as any).queryTransport.settings(settings),
        }),
      },
    },
  };
}
export function useTRPCClient() {
  return {
    library: {
      snapshot: { query: () => (window as any).queryTransport.snapshot() },
    },
  };
}
