import { useEffect, useState } from "react";
import type { Instance, Page } from "@/utils/interface";

// One renderer-owned selection survives page unmounts; editor URLs take priority.
export function useInstanceSelection(instances: Instance[], page: Page) {
  const [requestedId, setRequestedId] = useState("");
  const routeId = page.startsWith("instances/edit/")
    ? page.slice("instances/edit/".length)
    : "";
  const routeInstance = instances.find((item) => item.id === routeId);
  useEffect(() => {
    if (routeInstance) setRequestedId(routeInstance.id);
  }, [routeInstance?.id]);
  const selectedInstanceId =
    routeInstance?.id ??
    instances.find((item) => item.id === requestedId)?.id ??
    instances[0]?.id ??
    "";
  return { selectedInstanceId, onInstanceChange: setRequestedId };
}
