import { z } from "@gorth-io/structure/cores/zod";
import { supportedLoader } from "@/lib/game/catalog";

export const createInstanceSchema = z
  .object({
    action: z.literal("create"),
    name: z.string().trim().min(1).max(60),
    version: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,59}$/),
    loader: z.enum(["Vanilla", "Fabric", "Forge", "NeoForge"]),
    loaderVersion: z.string().max(60).nullish(),
    group: z.string().trim().max(60).nullish(),
    iconData: z
      .enum([
        "lucide:box",
        "lucide:gamepad",
        "lucide:mountain",
        "lucide:rocket",
        "lucide:star",
        "lucide:flame",
      ])
      .nullish(),
  })
  .refine(
    supportedLoader,
    "Phiên bản mod loader không nằm trong danh sách được hỗ trợ.",
  );
