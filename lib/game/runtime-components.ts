import type { Instance, RuntimeComponent } from "@/utils/interface";
import { readJson, safePath } from "./files";
import { validateInstance } from "./install";

export async function runtimeComponents(
  root: string,
  instance: Instance,
): Promise<RuntimeComponent[]> {
  validateInstance(instance);
  let lwjgl = "Chưa tải metadata";
  try {
    const metadata = await readJson<{ libraries?: { name?: string }[] }>(
      safePath(root, `versions/${instance.version}/${instance.version}.json`),
    );
    const name = metadata.libraries?.find(
      (item) =>
        item.name?.startsWith("org.lwjgl:lwjgl:") ||
        item.name?.startsWith("org.lwjgl.lwjgl:lwjgl:"),
    )?.name;
    if (name) lwjgl = name.split(":")[2];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return [
    { id: "lwjgl", name: "LWJGL", version: lwjgl },
    { id: "minecraft", name: "Minecraft", version: instance.version },
    ...(instance.loader === "Vanilla"
      ? []
      : [
          {
            id: "loader",
            name: instance.loader,
            version: instance.loaderVersion ?? "Chưa chọn phiên bản",
          },
        ]),
  ];
}
