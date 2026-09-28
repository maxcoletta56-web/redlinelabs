import assert from "node:assert/strict";
import test from "node:test";
import { promoPost } from "./promo-api.ts";

test("POST /api/promo accepts FAMILY70 case-insensitively", async () => {
  const response = await promoPost(
    new Request("http://localhost/api/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "family70" }),
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: "FAMILY70",
    percentOff: 70,
    name: "70% off order total",
  });
});

test("POST /api/promo rejects an unknown code", async () => {
  const response = await promoPost(
    new Request("http://localhost/api/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "NOPE" }),
    }),
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Invalid code" });
});

test("POST /api/promo rejects a malformed body", async () => {
  const response = await promoPost(
    new Request("http://localhost/api/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Invalid code" });
});
