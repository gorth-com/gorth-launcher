import { spawnSync } from "node:child_process";

const result = spawnSync(
  "pnpm",
  [
    "exec",
    "vitest",
    "run",
    "tests/auth.test.ts",
    "tests/auth-service.test.ts",
    "tests/auth-view.test.ts",
  ],
  {
    stdio: "inherit",
  },
);
process.exitCode = result.status ?? 1;
