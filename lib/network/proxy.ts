import { z } from "@gorth-io/structure/cores/zod";

export const proxySettingsSchema = z
  .object({
    mode: z.enum(["system", "direct", "http", "socks5"]),
    host: z.string().trim().max(253).default(""),
    port: z.number().int().min(1).max(65535).default(8080),
  })
  .superRefine((value, context) => {
    if (value.mode === "system" || value.mode === "direct") return;
    // Accept a hostname, IPv4 or bracketed IPv6, never a URL or proxy rule.
    try {
      if (!value.host || /[\s/@?#;,\\\\]/.test(value.host)) throw new Error();
      const url = new URL("http://" + value.host + ":" + value.port);
      if (
        url.hostname.toLowerCase() !== value.host.toLowerCase() ||
        (url.port && Number(url.port) !== value.port)
      )
        throw new Error();
    } catch {
      context.addIssue({
        code: "custom",
        path: ["host"],
        message: "Enter a hostname or IP address, without a scheme or path.",
      });
    }
  });
export type ProxySettings = z.infer<typeof proxySettingsSchema>;
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
export function electronProxyConfig(settings: ProxySettings) {
  if (settings.mode === "system" || settings.mode === "direct")
    return { mode: settings.mode };
  return {
    mode: "fixed_servers" as const,
    proxyRules: settings.mode + "://" + settings.host + ":" + settings.port,
    // Keep the desktop server, RPC and OAuth loopback callback local.
    proxyBypassRules: "localhost;127.0.0.1;[::1]",
  };
}
