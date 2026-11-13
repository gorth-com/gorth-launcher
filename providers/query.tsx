import { useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@gorth-io/primitive/cores/tanstack/query";
import { createDesktopClient, TRPCProvider } from "@/lib/rpc/client";
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(createDesktopClient);
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
