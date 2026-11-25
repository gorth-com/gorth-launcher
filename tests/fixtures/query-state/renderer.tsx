/* oxlint-disable typescript/no-explicit-any -- This test harness exercises two applications' partial DTOs with fake IPC only. */
import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
} from "@gorth-com/primitive/cores/tanstack/query";
import { useLibrary } from "@/hooks/use-library";
import { useGame } from "@/hooks/use-game";
import { useAuthController } from "@/hooks/use-auth-controller";
import { notifyApplicationReady } from "@/utils/application-ready";
import { defaultSettings } from "@/utils/constant";

const fixture = window as any;
fixture.IS_REACT_ACT_ENVIRONMENT = true;
const pause = () => new Promise((resolve) => setTimeout(resolve, 15));
async function settle() {
  await React.act(async () => {
    await pause();
  });
}
function check(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
fixture.queryStateTest = (async () => {
  let libraryListener: (value: any) => void = () => {};
  let gameListener: (value: any) => void = () => {};
  let authListener: (value: any) => void = () => {};
  const library = {
    instances: [],
    settings: defaultSettings,
    instanceSettings: {},
    trash: [],
  };
  const game = {
    directory: "old",
    jobs: [],
    activeId: null,
    activeIds: [],
    queue: [],
    downloadingId: null,
    history: [],
  };
  const account = {
    id: "dummy",
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 600000,
    canRefresh: true,
  };
  let auth: any = {
    launcher: null,
    user: null,
    locked: true,
    configured: true,
    pending: null,
    busy: false,
  };
  const calls: any[] = [];
  const writes: any[] = [];
  const oldGame = deferred<any>();
  fixture.electronAPI = {
    library: {
      onChanged: (callback: any) => {
        libraryListener = callback;
        return () => {
          libraryListener = () => {};
        };
      },
      command: async () => ({ ok: true, snapshot: library }),
    },
    game: {
      onChanged: (callback: any) => {
        gameListener = callback;
        return () => {
          gameListener = () => {};
        };
      },
      snapshot: () => oldGame.promise,
      versions: async () => [{ id: "1.20.1", type: "release" }],
    },
    auth: {
      onChanged: (callback: any) => {
        authListener = callback;
        return () => {
          authListener = () => {};
        };
      },
      snapshot: async () => ({ ok: true, snapshot: auth }),
      command: async (command: any) => {
        calls.push(command);
        auth = { ...auth, locked: false, launcher: account, user: account };
        return { ok: true, snapshot: auth };
      },
    },
  };
  fixture.queryTransport = {
    snapshot: async () => library,
    settings: (settings: any) => {
      const gate = deferred<any>();
      writes.push({ settings, gate });
      return gate.promise;
    },
  };
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  let controller: any;
  const render = async (hook: () => unknown) => {
    const client = new QueryClient();
    function Harness() {
      controller = hook();
      return null;
    }
    await React.act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(
            React.StrictMode,
            null,
            React.createElement(Harness),
          ),
        ),
      );
    });
    await settle();
    return client;
  };
  const client = await render(useLibrary);
  console.log("query fixture: library mounted");
  check(controller.ready, "library never became ready");
  React.act(() => {
    controller.setSettings((value: any) => ({ ...value, javaPath: "java-A" }));
    controller.setSettings((value: any) => ({ ...value, javaPath: "java-B" }));
  });
  await settle();
  check(writes.length === 1, "settings writes were not serialized");
  check(
    controller.settings.javaPath === "java-B",
    "latest optimistic settings lost",
  );
  React.act(() =>
    libraryListener({
      ...library,
      settings: { ...defaultSettings, javaPath: "java-A" },
    }),
  );
  check(
    controller.settings.javaPath === "java-B",
    "IPC overwrote pending settings",
  );
  writes[0].gate.resolve({
    ok: true,
    snapshot: { ...library, settings: writes[0].settings },
  });
  await settle();
  check(writes.length === 2, "second settings write never started");
  check(
    controller.settings.javaPath === "java-B",
    "older write overwrote newer settings",
  );
  writes[1].gate.resolve({
    ok: true,
    snapshot: { ...library, settings: writes[1].settings },
  });
  await settle();
  React.act(() =>
    controller.setSettings((value: any) => ({ ...value, javaPath: "java-C" })),
  );
  await settle();
  writes[2].gate.reject(new Error("dummy storage failure"));
  await settle();
  check(
    controller.settings.javaPath === "java-B",
    "failed settings did not roll back",
  );
  check(controller.error, "failed settings error was lost");
  client.clear();
  console.log("query fixture: settings verified");

  const gameClient = await render(useGame);
  console.log("query fixture: game mounted");
  React.act(() => gameListener({ ...game, directory: "new-event" }));
  oldGame.resolve(game);
  await settle();
  check(
    controller.game.directory === "new-event",
    "stale game snapshot overwrote IPC",
  );
  gameClient.clear();
  console.log("query fixture: game verified");

  const authClient = await render(useAuthController);
  console.log("query fixture: launcher auth mounted");
  check(controller.ready, "locked auth blocks app shell");
  check(calls.length === 0, "unlock ran before application paint");
  notifyApplicationReady();
  await settle();
  check(calls.length === 1, "startup unlock duplicated in StrictMode");
  check(
    !controller.busy && controller.auth.launcher.id === "dummy",
    "unlock did not update query snapshot",
  );
  React.act(() => authListener({ ...auth, locked: true, launcher: null }));
  await settle();
  check(
    controller.locked && !controller.authenticated,
    "auth revocation IPC was ignored",
  );
  authClient.clear();

  await React.act(async () => {
    root.unmount();
  });
  return {
    serializedSettings: true,
    rollback: true,
    gameRace: true,
    launcherAuth: true,
  };
})();
