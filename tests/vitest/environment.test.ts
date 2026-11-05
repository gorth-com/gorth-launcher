import { afterEach, expect, it, vi } from "vitest";
import { build } from "vite";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";

afterEach(() => vi.unstubAllEnvs());
it("embeds packaged public env through Vite without requiring Electron process.env", async () => {
  vi.stubEnv("VITE_PUBLIC_APP_URL", "http://localhost:5509");
  vi.stubEnv("VITE_PUBLIC_AUTH_URL", "https://auth.example.test");
  vi.stubEnv("VITE_PUBLIC_OAUTH_CLIENT_ID", "test-native-client");
  const result = await build({
    configFile: false,
    envDir: false,
    logLevel: "silent",
    root: fileURLToPath(new URL("../../", import.meta.url)),
    define: { MAIN_WINDOW_VITE_DEV_SERVER_URL: "undefined" },
    build: {
      write: false,
      lib: { entry: "utils/environment.ts", formats: ["cjs"] },
    },
  });
  const output = Array.isArray(result) ? result[0] : result;
  if (!("output" in output)) throw new Error("No bundled environment module.");
  const chunk = output.output.find((item) => item.type === "chunk");
  if (!chunk || chunk.type !== "chunk")
    throw new Error("No environment chunk.");
  const exports: Record<string, unknown> = {};
  runInNewContext(chunk.code, { exports, process: { env: {} } });
  expect(exports.appUrl).toBe("http://localhost:5509");
  expect(exports.authUrl).toBe("https://auth.example.test");
  expect(exports.oauthClientId).toBe("test-native-client");
});
