import { expect, it } from "vitest";
import { createConfirmationQueue } from "@/lib/confirmation";

it("serializes confirmations and resolves each answer once", async () => {
  const queue = createConfirmationQueue();
  const first = queue.ask("First", "first");
  const second = queue.ask("Second", "second");
  expect(queue.current()?.id).toBe("first");
  queue.answer("first", false);
  queue.answer("first", true);
  expect(await first).toBe(false);
  expect(queue.current()?.id).toBe("second");
  queue.answer("second", true);
  expect(await second).toBe(true);
  expect(queue.current()).toBeNull();
});
it("denies pending requests on provider teardown", async () => {
  const queue = createConfirmationQueue();
  const first = queue.ask("First");
  const second = queue.ask("Second");
  queue.cancelAll();
  expect(await Promise.all([first, second])).toEqual([false, false]);
  expect(queue.current()).toBeNull();
});
