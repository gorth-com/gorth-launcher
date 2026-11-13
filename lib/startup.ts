import { launcherPages, instanceEditSections } from "@/utils/constant";
import type { LibrarySnapshot } from "@/utils/interface";

export function validStartupLocation(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return false;
  const url = new URL(value, "https://launcher.invalid");
  if (url.origin !== "https://launcher.invalid" || url.hash) return false;
  const page = url.pathname.slice(1);
  if (
    !launcherPages.some((item) => item === page) &&
    !/^instances\/edit\/[a-zA-Z0-9-]{1,80}$/.test(page)
  )
    return false;
  return [...url.searchParams].every(
    ([key, val]) =>
      key === "section" &&
      page.startsWith("instances/edit/") &&
      instanceEditSections.some((section) => section.id === val),
  );
}

export function startupLocation(snapshot: LibrarySnapshot): string {
  const mode = snapshot.settings.startup ?? "restore";
  // Specific-page startup is disabled; older saved choices use the Home behavior.
  const location =
    mode === "restore" ? (snapshot.lastLocation ?? "/home") : "/home";
  if (!validStartupLocation(location)) return "/home";
  const id = /^\/instances\/edit\/([^?]+)/.exec(location)?.[1];
  return id && !snapshot.instances.some((instance) => instance.id === id)
    ? "/instances"
    : location;
}
