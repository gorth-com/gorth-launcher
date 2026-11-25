import { describe, expect, it } from "vitest";
import { proxyUpdateSchema } from "@/lib/network/proxy";
import {
  electronProxyConfig,
  proxySettingsSchema,
} from "@gorth-com/structure/modules/desktop";
describe("proxy settings", () => {
  it("rejects URL credentials, rule injection and invalid ports", () => {
    for (const host of [
      "https://host",
      "user:pass@host",
      "host/path",
      "host;DIRECT",
      "host,other",
      "host?x=1",
      "",
      "host name",
    ]) {
      expect(
        proxySettingsSchema.safeParse({ mode: "http", host, port: 8080 })
          .success,
        host,
      ).toBe(false);
    }
    for (const port of [0, -1, 65536, 3.5])
      expect(
        proxySettingsSchema.safeParse({ mode: "http", host: "localhost", port })
          .success,
      ).toBe(false);
  });
  it("accepts IPv4, DNS, IPv6 and keeps local desktop routes direct", () => {
    for (const host of ["127.0.0.1", "proxy.example.com", "[::1]"])
      expect(
        proxySettingsSchema.safeParse({ mode: "socks5", host, port: 1080 })
          .success,
        host,
      ).toBe(true);
    expect(
      electronProxyConfig({ mode: "http", host: "localhost", port: 8080 }),
    ).toEqual({
      mode: "fixed_servers",
      proxyRules: "http://localhost:8080",
      proxyBypassRules: "localhost;127.0.0.1;[::1]",
    });
    expect(
      electronProxyConfig({ mode: "system", host: "", port: 8080 }),
    ).toEqual({ mode: "system" });
    expect(
      electronProxyConfig({ mode: "direct", host: "", port: 8080 }),
    ).toEqual({ mode: "direct" });
  });
  it("does not pretend SOCKS5 password authentication is supported", () => {
    expect(
      proxyUpdateSchema.safeParse({
        settings: { mode: "socks5", host: "localhost", port: 1080 },
        credentials: { username: "user", password: "secret" },
      }).success,
    ).toBe(false);
  });
});
