import { useState } from "react";
import { RouterProvider } from "@gorth-io/primitive/cores/tanstack/router";
import Application from "@/app";
import { createLauncherRouter } from "@/lib/navigation";

function LauncherRouter() {
  const [router] = useState(() => createLauncherRouter(Application));
  return <RouterProvider router={router} />;
}
export { LauncherRouter };
