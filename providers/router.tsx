import { useEffect, useState } from "react";
import { startupLocation, validStartupLocation } from "@/lib/startup";
import { toast } from "@/providers/toaster";
import { RouterProvider } from "@gorth-io/primitive/cores/tanstack/router";
import Application from "@/app";
import { createLauncherRouter } from "@/lib/navigation";

function RestoredLauncherRouter({ location }: { location: string }) {
  const [router] = useState(() => createLauncherRouter(Application, location));
  useEffect(
    () =>
      router.subscribe("onResolved", () => {
        const location = router.state.location.href;
        if (!validStartupLocation(location)) return;
        void window.electronAPI.library
          .command({ action: "navigation.save", location })
          .then((result) => {
            if (!result.ok) throw new Error();
          })
          .catch(() =>
            toast.add({ title: "Không lưu được trang đang mở", type: "error" }),
          );
      }),
    [router],
  );
  return <RouterProvider router={router} />;
}
function LauncherRouter() {
  const [location, setLocation] = useState<string>();
  useEffect(() => {
    let active = true;
    void window.electronAPI.library
      .snapshot()
      .then((snapshot) => {
        if (active) setLocation(startupLocation(snapshot));
      })
      .catch(() => {
        if (active) {
          toast.add({
            title: "Không khôi phục được trang trước đó",
            type: "error",
          });
          setLocation("/home");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  return location ? (
    <RestoredLauncherRouter location={location} />
  ) : (
    <p role="status">Đang khôi phục Launcher…</p>
  );
}
export { LauncherRouter };
