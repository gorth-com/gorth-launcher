import { expect, it, vi } from "vitest";
import {
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "@gorth-com/structure/cores/axios";

const fixture = vi.hoisted(() => ({ install: vi.fn() }));
vi.mock("@/utils/caller", () => ({
  callerClient: { interceptors: { request: { use: fixture.install } } },
}));

it("keeps Electron renderer requests on XHR even when shared caller picks fetch", async () => {
  await import("@/lib/http/renderer");
  expect(fixture.install).toHaveBeenCalledTimes(1);
  const configure = fixture.install.mock.calls[0][0] as (
    config: InternalAxiosRequestConfig,
  ) => InternalAxiosRequestConfig;
  for (const adapter of [undefined, "fetch"]) {
    const config = { headers: new AxiosHeaders(), adapter };
    expect(configure(config).adapter).toBe("xhr");
  }
  const adapter = vi.fn();
  expect(configure({ headers: new AxiosHeaders(), adapter }).adapter).toBe(
    adapter,
  );
});
