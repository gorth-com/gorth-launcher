import { createTRPCClient, httpLink } from "@trpc/client";
import { createDesktopRpcTransport } from "@gorth-com/structure/modules/desktop";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { DesktopRouter } from "@/main/rpc/router";

export function createDesktopClient() {
  return createTRPCClient<DesktopRouter>({
    links: [
      httpLink({
        url: "https://desktop.invalid/trpc",
        fetch: createDesktopRpcTransport({
          maxBodyBytes: 8_000_000,
          request: (input) => window.electronAPI.rpc.request(input),
        }),
      }),
    ],
  });
}
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<DesktopRouter>();
