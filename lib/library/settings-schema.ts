import { z } from "@gorth-io/structure/cores/zod";
import {
  javaPreferencesSchema,
  minecraftPreferencesSchema,
} from "./game-preferences";

export const settingsSchema = z.object({
  java: javaPreferencesSchema.optional(),
  minecraft: minecraftPreferencesSchema.optional(),
  locale: z.enum(["system", "en", "vi"]).default("system"),
  instanceSort: z.enum(["name", "last-played"]).default("name"),
  consoleLogLimit: z.number().int().min(100).max(100000).default(1000),
  toolPaths: z
    .object({
      textEditor: z.string().max(4096).optional(),
      mcedit: z.string().max(4096).optional(),
      jprofiler: z.string().max(4096).optional(),
      visualvm: z.string().max(4096).optional(),
    })
    .default({}),
  sidebarCollapsible: z.boolean().default(true),
  sidebarCollapseMode: z.enum(["icon", "none"]).default("none"),
  profileName: z.string().trim().min(1).max(80).default("Personal"),
  profileIcon: z.enum(["globe", "user", "rocket", "star"]).default("user"),
  tabLayout: z.enum(["separate", "compact"]).default("separate"),
  showTitlebarLogo: z.boolean().default(true),
  memory: z.number().int().min(1).max(64),
  javaPath: z.string().max(4096),
  trashRetentionDays: z.number().int().min(0).max(365).default(30),
  keepSavesOnTrashCleanup: z.boolean().default(true),
});
