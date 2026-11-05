import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { build } from "vite";
import { loadDevelopmentEnvironment } from "@/utils/development-environment";

const directories: string[] = [];
async function directory() {
  const root = await mkdtemp(path.join(os.tmpdir(), "gorth-env-test-"));
  directories.push(root);
  return root;
}
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    directories
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

it("loads private and public keys, preserving dollars, quotes, multiline and empty values", async () => {
  const root = await directory();
  for (const key of [
    "CURSEFORGE_API_KEY",
    "GORTH_TEST_PRIVATE",
    "VITE_PUBLIC_ENV_FIXTURE",
    "GORTH_TEST_EMPTY",
    "GORTH_TEST_MULTILINE",
  ])
    vi.stubEnv(key, undefined);
  await writeFile(
    path.join(root, ".env.local"),
    [
      "CURSEFORGE_API_KEY='$2a$fixture$literal'",
      'GORTH_TEST_PRIVATE="value with spaces # kept"',
      "VITE_PUBLIC_ENV_FIXTURE=public-fixture",
      "GORTH_TEST_EMPTY=",
      'GORTH_TEST_MULTILINE="first\\nsecond"',
    ].join("\n"),
  );
  loadDevelopmentEnvironment(root);
  expect(process.env.CURSEFORGE_API_KEY).toBe("$2a$fixture$literal");
  expect(process.env.GORTH_TEST_PRIVATE).toBe("value with spaces # kept");
  expect(process.env.VITE_PUBLIC_ENV_FIXTURE).toBe("public-fixture");
  expect(process.env.GORTH_TEST_EMPTY).toBe("");
  expect(process.env.GORTH_TEST_MULTILINE).toBe("first\nsecond");
});

it("preserves shell/CI values instead of replacing them with the file", async () => {
  const root = await directory();
  vi.stubEnv("GORTH_TEST_PRIVATE", "shell-value");
  await writeFile(
    path.join(root, ".env.local"),
    "GORTH_TEST_PRIVATE=file-value",
  );
  loadDevelopmentEnvironment(root);
  expect(process.env.GORTH_TEST_PRIVATE).toBe("shell-value");
});

it("allows a missing local file but surfaces other IO failures without contents", async () => {
  const root = await directory();
  expect(() => loadDevelopmentEnvironment(root)).not.toThrow();
  await mkdir(path.join(root, ".env.local"));
  expect(() => loadDevelopmentEnvironment(root)).toThrow(
    "Không thể nạp .env.local",
  );
});

it("does not expose loaded private values through Vite import.meta.env", async () => {
  const root = await directory();
  vi.stubEnv("GORTH_TEST_PRIVATE", undefined);
  await writeFile(
    path.join(root, ".env.local"),
    "GORTH_TEST_PRIVATE=private-build-fixture",
  );
  loadDevelopmentEnvironment(root);
  const entry = path.join(root, "entry.ts");
  await writeFile(entry, "export const environment = import.meta.env;");
  const result = await build({
    root,
    configFile: false,
    envDir: false,
    logLevel: "silent",
    build: { write: false, lib: { entry, formats: ["es"] } },
  });
  const bundle = Array.isArray(result) ? result[0] : result;
  if (!("output" in bundle)) throw new Error("Missing build output");
  const output = bundle.output
    .filter((item) => item.type === "chunk")
    .map((item) => item.code)
    .join("\n");
  expect(output).not.toContain("private-build-fixture");
  expect(output).not.toContain("GORTH_TEST_PRIVATE");
});

it("wires the loader to preStart, not application runtime or packaging", async () => {
  const source = await readFile(
    new URL("../../forge.config.ts", import.meta.url),
    "utf8",
  );
  expect(source).toMatch(
    /preStart:\s*async\s*\(\)\s*=>\s*{\s*loadDevelopmentEnvironment\(fileURLToPath\(new URL\("\.", import.meta.url\)\)\)/,
  );
});
