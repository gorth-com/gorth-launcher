import {
  useRouter,
  useRouterState,
} from "@gorth-com/primitive/cores/tanstack/router";
import { useCallback } from "react";
import type { Page } from "@/utils/interface";

export function useLauncherNavigation() {
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const page = location.pathname.slice(1) as Page;
  const index = location.state.__TSR_index ?? 0;
  const navigate = useCallback(
    (next: Page, options?: { section?: string; replace?: boolean }) => {
      if (next === "library") next = "instances";
      if (next === "instance-data") next = "instances/data";
      if (router.state.location.pathname !== "/" + next || options?.section)
        void router.navigate({
          to: "/" + next,
          search: options?.section ? { section: options.section } : {},
          replace: options?.replace,
        });
    },
    [router],
  );
  return {
    page,
    editSection:
      typeof location.search.section === "string"
        ? location.search.section
        : undefined,
    navigate,
    back: () => router.history.back(),
    forward: () => router.history.forward(),
    canGoBack: index > 0,
    canGoForward: index < router.history.length - 1,
  };
}
