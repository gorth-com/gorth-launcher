import { createDesktopRpcHandler } from "@gorth-io/structure/modules/desktop";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { AnyRouter } from "@trpc/server";
import type { RpcResponse } from "@/lib/rpc/interface";

// IPC sender/mainFrame authorization stays in the app's main/ipc/rpc handler.
export async function handleRpcRequest<TContext>(
  router: AnyRouter,
  input: unknown,
  context: TContext,
): Promise<RpcResponse> {
  return createDesktopRpcHandler({
    maxBodyBytes: 8_000_000,
    handle: (req) =>
      fetchRequestHandler({
        endpoint: "/trpc",
        req,
        router,
        createContext: () => context,
      }),
  })(input);
}
