import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@gorth-com/primitive/cores/tanstack/query", () => ({
  useQuery: () => ({
    data: { ok: true, snapshot: fixture.snapshot },
    isFetched: true,
  }),
  useQueryClient: () => ({ cancelQueries: vi.fn(), setQueryData: vi.fn() }),
}));
vi.mock("@/utils/application-ready", () => ({
  waitForApplicationReady: () => fixture.paint(),
}));

const fixture = vi.hoisted(() => ({
  snapshot: {} as Record<string, unknown>,
  command: vi.fn(),
  paint: vi.fn(),
  cleanups: [] as Array<() => void>,
  focus: undefined as undefined | (() => void),
}));

// Exercise the actual scheduler without a DOM or native/live account access.
vi.mock("react", () => ({
  useState: (initial: unknown) => [
    initial == null ? fixture.snapshot : initial,
    vi.fn(),
  ],
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (cleanup) fixture.cleanups.push(cleanup);
  },
}));

beforeEach(() => {
  fixture.paint.mockReset().mockResolvedValue(undefined);
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const account = {
    id: "fixture-subject",
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 600_000,
    canRefresh: true,
    needsLogin: false,
  };
  fixture.snapshot = {
    user: account,
    launcher: account,
    locked: false,
    busy: false,
    pending: null,
    providers: { gorthLauncher: true, ely: false, gorthGame: true },
  };
  fixture.command.mockReset().mockResolvedValue({
    ok: true,
    snapshot: fixture.snapshot,
  });
  vi.stubGlobal("window", {
    electronAPI: {
      auth: {
        onChanged: () => () => {},
        snapshot: async () => ({ ok: true, snapshot: fixture.snapshot }),
        command: fixture.command,
      },
    },
    addEventListener: (_event: string, callback: () => void) => {
      fixture.focus = callback;
    },
    removeEventListener: () => {
      fixture.focus = undefined;
    },
  });
});
it("waits for the application to paint before automatically unlocking", async () => {
  fixture.snapshot.locked = true;
  fixture.snapshot.launcher = null;
  let painted!: () => void;
  fixture.paint.mockReturnValue(
    new Promise<void>((resolve) => {
      painted = resolve;
    }),
  );
  const { useAuthController } = await import("@/hooks/use-auth-controller");
  useAuthController();
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.command).not.toHaveBeenCalled();
  painted();
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.command).toHaveBeenCalledExactlyOnceWith({
    action: "launcher.unlock",
  });
});

afterEach(() => {
  for (const cleanup of fixture.cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("does not refresh on each tick/focus; checks identity at the native 90-second refresh boundary", async () => {
  const { useAuthController } = await import("@/hooks/use-auth-controller");
  useAuthController();
  fixture.focus?.();
  await vi.advanceTimersByTimeAsync(89_999);
  expect(fixture.command).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(fixture.command).toHaveBeenCalledTimes(1);
});

it("refreshes expiring credentials according to the shared leeway", async () => {
  const account = fixture.snapshot.user as { expiresAt: number };
  account.expiresAt = Date.now() + 29_000;
  const { useAuthController } = await import("@/hooks/use-auth-controller");
  useAuthController();
  await vi.advanceTimersByTimeAsync(0);
  fixture.focus?.();
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.command).toHaveBeenCalledTimes(1);
});

it("does not unlock or refresh during a pending auth operation", async () => {
  fixture.snapshot.locked = true;
  fixture.snapshot.launcher = null;
  fixture.snapshot.pending = "launcher.login";
  const { useAuthController } = await import("@/hooks/use-auth-controller");
  useAuthController();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fixture.command).not.toHaveBeenCalled();
  fixture.snapshot.locked = false;
  fixture.snapshot.launcher = fixture.snapshot.user;
  fixture.snapshot.busy = true;
  fixture.snapshot.pending = "launcher.login";
  fixture.focus?.();
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.command).not.toHaveBeenCalled();
});

it("restores saved credentials once on startup, never from polling or focus", async () => {
  fixture.snapshot.locked = true;
  fixture.snapshot.launcher = null;
  const { useAuthController } = await import("@/hooks/use-auth-controller");
  const controller = useAuthController();
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.command).toHaveBeenCalledExactlyOnceWith({
    action: "launcher.unlock",
  });
  fixture.focus?.();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fixture.command).toHaveBeenCalledTimes(1);

  fixture.command.mockClear();
  await controller.login();
  expect(fixture.command).toHaveBeenCalledExactlyOnceWith({
    action: "launcher.login",
  });
});

it("allows an explicit retry after failed startup restoration without automatic retries", async () => {
  fixture.snapshot.locked = true;
  fixture.snapshot.launcher = null;
  fixture.command.mockResolvedValue({
    ok: false,
    error: "Keychain locked",
    snapshot: fixture.snapshot,
  });
  const { useAuthController } = await import("@/hooks/use-auth-controller");
  const controller = useAuthController();
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.command).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fixture.command).toHaveBeenCalledTimes(1);
  fixture.command.mockClear();
  await controller.unlock();
  expect(fixture.command).toHaveBeenCalledExactlyOnceWith({
    action: "launcher.unlock",
  });
});
