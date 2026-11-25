import { z } from "@gorth-com/structure/cores/zod";
import {
  proxySettingsSchema,
  type ProxySettings,
} from "@gorth-com/structure/modules/desktop";

export interface ProxyView extends ProxySettings {
  hasCredentials: boolean;
}
export const proxyUpdateSchema = z
  .object({
    settings: proxySettingsSchema,
    credentials: z
      .object({
        username: z.string().min(1).max(512),
        password: z.string().max(4096),
      })
      .optional(),
    clearCredentials: z.boolean().default(false),
  })
  .refine(
    (value) => !value.credentials || value.settings.mode === "http",
    "Credentials are supported for HTTP proxies only.",
  );
export type ProxyUpdate = z.input<typeof proxyUpdateSchema>;
export const defaultProxySettings: ProxySettings = {
  mode: "system",
  host: "",
  port: 8080,
};
