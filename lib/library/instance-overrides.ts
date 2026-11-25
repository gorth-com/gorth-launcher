import { z } from "@gorth-com/structure/cores/zod";
import type { InstanceSettings } from "@/utils/interface";

export const instanceOverridesSchema = z.object({
  elyPatch: z.boolean().default(false),
  gameWindow: z.boolean().default(false),
  consoleWindow: z.boolean().default(false),
  gameTime: z.boolean().default(false),
  account: z.boolean().default(false),
  autoJoin: z.boolean().default(false),
  javaInstallation: z.boolean().default(false),
  memory: z.boolean().default(false),
  javaArguments: z.boolean().default(false),
  nativeLibraries: z.boolean().default(false),
  commands: z.boolean().default(false),
  environment: z.boolean().default(false),
});
export type InstanceOverrides = z.infer<typeof instanceOverridesSchema>;

// Missing flags identify the old format. Preserve its explicit values on edit.
export function instanceOverrides(value: InstanceSettings): InstanceOverrides {
  return (
    value.overrides ??
    instanceOverridesSchema.parse({
      gameWindow: true,
      account: value.accountId !== null,
      autoJoin: !!(value.joinServer || value.joinWorld),
      javaInstallation: !!value.javaPath,
      memory: true,
      javaArguments: true,
      nativeLibraries: true,
      commands: true,
      environment: true,
    })
  );
}
