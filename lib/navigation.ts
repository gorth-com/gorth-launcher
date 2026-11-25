import { launcherPages } from "@/utils/constant";
import type { Page } from "@/utils/interface";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type RouteComponent,
} from "@gorth-com/primitive/cores/tanstack/router";

function createLauncherRouter(
  component: RouteComponent,
  initialLocation = "/home",
) {
  const root = createRootRoute({ component });
  const routes = launcherPages.map((page) =>
    createRoute({
      getParentRoute: () => root,
      path: "/" + page,
      beforeLoad: () => {
        if (page === "library")
          throw redirect({ to: "/instances", replace: true });
        if (page === "instance-data")
          throw redirect({ to: "/instances/data", replace: true });
      },
    }),
  );
  return createRouter({
    routeTree: root.addChildren([
      ...routes,
      createRoute({
        getParentRoute: () => root,
        path: "/instances/edit/$uuid",
        validateSearch: (search: Record<string, unknown>) => ({
          section:
            typeof search.section === "string" ? search.section : undefined,
        }),
      }),
    ]),
    history: createMemoryHistory({ initialEntries: [initialLocation] }),
    defaultPendingMinMs: 0,
  });
}
export function instanceToolDestination(
  page: Page,
  instanceId: string,
): { page: Page; section?: string } | undefined {
  if (page !== "gallery" && page !== "instances/data") return;
  return instanceId
    ? {
        page: `instances/edit/${instanceId}`,
        section: page === "gallery" ? "screenshots" : "notes",
      }
    : { page: "instances" };
}
export { createLauncherRouter };
