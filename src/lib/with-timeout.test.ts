import assert from "node:assert/strict";
import test from "node:test";
import { TimeoutError, withTimeout } from "./with-timeout.ts";

test("a settled promise passes straight through", async () => {
  assert.equal(await withTimeout(Promise.resolve("done"), 1000, "Checkout"), "done");
  await assert.rejects(
    () => withTimeout(Promise.reject(new Error("provider said no")), 1000, "Checkout"),
    /provider said no/,
  );
});

test("a hung promise rejects with a named timeout instead of hanging", async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 5, "Checkout"),
    (error: unknown) => {
      assert.ok(error instanceof TimeoutError);
      assert.equal(error.name, "TimeoutError");
      assert.match(error.message, /^Checkout did not respond within/);
      return true;
    },
  );
});

test("the timer is cleared so the process can exit", async () => {
  await withTimeout(Promise.resolve(1), 60_000, "Checkout");
});
