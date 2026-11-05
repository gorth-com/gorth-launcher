import { spawnSync } from "node:child_process";
// The Vitest runner creates and removes a dedicated native profile.
const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "tests/vitest/auth-embedded.test.ts"],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
