import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { trackDevelopmentProcess } from "@/main/services/forge-lifecycle";

describe("Forge child cleanup", () => {
  it.each(["SIGINT", "SIGTERM", "exit"] as const)(
    "forwards %s before Vite can exit and detaches on restart",
    (event) => {
      const previous = process.listeners(event);
      const child = Object.assign(new EventEmitter(), {
        exitCode: null,
        signalCode: null,
        killed: false,
        kill: vi.fn(() => true),
      });
      trackDevelopmentProcess(child as unknown as ChildProcess);
      const listener = process
        .listeners(event)
        .find((candidate) => !previous.includes(candidate));
      try {
        expect(listener).toBeDefined();
        if (event !== "exit")
          expect(process.listeners(event)[0]).toBe(listener);
        Reflect.apply(listener!, process, event === "exit" ? [0] : [event]);
        expect(child.kill).toHaveBeenCalledWith("SIGTERM");
      } finally {
        child.emit("exit", 0);
      }
      expect(process.listeners(event)).not.toContain(listener);
    },
  );

  it("does not signal an already exited child", () => {
    const previous = process.listeners("SIGINT");
    const child = Object.assign(new EventEmitter(), {
      exitCode: 0,
      signalCode: null,
      killed: false,
      kill: vi.fn(),
    });
    trackDevelopmentProcess(child as unknown as ChildProcess);
    const listener = process
      .listeners("SIGINT")
      .find((candidate) => !previous.includes(candidate));
    try {
      listener!("SIGINT");
      expect(child.kill).not.toHaveBeenCalled();
    } finally {
      child.emit("exit", 0);
    }
  });
});
