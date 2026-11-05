import { spawnSync } from "node:child_process";

const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "tests/rpc.test.ts"],
  {
    stdio: "inherit",
  },
);
process.exitCode = result.status ?? 1;
