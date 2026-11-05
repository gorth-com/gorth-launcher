import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  app: {
    isPackaged: false,
    quit: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
    once: vi.fn(),
    off: vi.fn(),
  },
  request: vi.fn(),
}));
vi.mock("electron", () => ({ app: mocks.app }));
vi.mock("node:http", () => ({ get: mocks.request }));
vi.mock("node:https", () => ({ get: mocks.request }));

import { installDevelopmentLifecycle } from "@/main/services/development-lifecycle";

let dispose: (() => void) | undefined;
let probe: EventEmitter;
let respond: (response: IncomingMessage) => void;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.app.isPackaged = false;
  vi.spyOn(process, "kill").mockReturnValue(true);
  mocks.request.mockImplementation((_url, _options, callback) => {
    respond = callback;
    probe = Object.assign(new EventEmitter(), {
      setTimeout: vi.fn(),
      destroy: vi.fn(),
    });
    return probe as ClientRequest;
  });
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("development lifecycle", () => {
  it.each(["SIGINT", "SIGTERM"] as const)(
    "quits gracefully on %s",
    async (signal) => {
      const previous = process.listeners(signal);
      dispose = installDevelopmentLifecycle("http://localhost:5173");
      const handler = process
        .listeners(signal)
        .find((candidate) => !previous.includes(candidate));
      expect(handler).toBeDefined();
      Reflect.apply(handler!, process, [signal]);
      await Promise.resolve();
      expect(mocks.app.quit).toHaveBeenCalledOnce();
      expect(process.listeners(signal)).not.toContain(handler);
    },
  );

  it("quits when the dev parent no longer exists", async () => {
    vi.mocked(process.kill).mockImplementation(() => {
      throw Object.assign(new Error("Parent exited"), { code: "ESRCH" });
    });
    dispose = installDevelopmentLifecycle("http://localhost:5173");
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.app.quit).toHaveBeenCalledOnce();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("requires two failed probes and recovers after a successful response", async () => {
    dispose = installDevelopmentLifecycle("http://localhost:5173");
    await vi.advanceTimersByTimeAsync(1000);
    probe.emit("error", new Error("Connection refused"));
    await vi.advanceTimersByTimeAsync(1000);
    respond({ resume: vi.fn() } as unknown as IncomingMessage);
    await vi.advanceTimersByTimeAsync(1000);
    probe.emit("error", new Error("Connection refused"));
    await Promise.resolve();
    expect(mocks.app.quit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    probe.emit("error", new Error("Connection refused"));
    await Promise.resolve();
    expect(mocks.app.quit).toHaveBeenCalledOnce();
  });

  it("does not monitor packaged apps or a missing dev URL", () => {
    dispose = installDevelopmentLifecycle("");
    mocks.app.isPackaged = true;
    dispose = installDevelopmentLifecycle("http://localhost:5173");
    expect(mocks.app.once).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("cleans up probes and listeners when disposed", async () => {
    dispose = installDevelopmentLifecycle("http://localhost:5173");
    await vi.advanceTimersByTimeAsync(1000);
    const active = probe as ClientRequest;
    dispose();
    await vi.advanceTimersByTimeAsync(5000);
    expect(active.destroy).toHaveBeenCalledOnce();
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.app.quit).not.toHaveBeenCalled();
  });
});
