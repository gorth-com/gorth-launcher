import { useEffect, useRef } from "react";
import { useQuery } from "@gorth-com/primitive/cores/tanstack/query";
import type { Settings } from "@/utils/interface";
import { javaPreferences } from "@/lib/library/game-preferences";
import { confirmAction } from "@/lib/confirmation";
export function useJavaSetup(
  ready: boolean,
  settings: Settings,
  onSetup: () => void,
) {
  const asked = useRef(false);
  const enabled =
    ready && !javaPreferences(settings).skipSetupPrompt && !settings.javaPath;
  const installed = useQuery({
    queryKey: ["java-installations"],
    queryFn: () => window.electronAPI.settings.javaInstallations(),
    enabled,
    staleTime: 60000,
    retry: false,
  });
  useEffect(() => {
    if (
      !enabled ||
      !installed.isSuccess ||
      installed.data.length ||
      asked.current
    )
      return;
    asked.current = true;
    void confirmAction({
      title: "Set up Java?",
      description:
        "No local Java installation was found. You can choose an executable now, or let the launcher download a runtime when installing Minecraft.",
      confirmLabel: "Java settings",
      cancelLabel: "Later",
    }).then((answer) => {
      if (answer) onSetup();
    });
  }, [enabled, installed.isSuccess, installed.data, onSetup]);
}
