import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  createDistributionSessionValue,
  distributionCookieSecure,
  distributionSessionSecret,
  hashDistributionPassword,
  readDistributionSessionAccount,
  verifyDistributionPassword,
} from "./distribution-auth.ts";

const SECRET = "distribution-session-secret";

test("the session secret prefers the distribution secret and falls back to the admin secret", () => {
  assert.equal(distributionSessionSecret({}), null);
  assert.equal(distributionSessionSecret({ DISTRIBUTION_SESSION_SECRET: "short" }), null);
  assert.equal(
    distributionSessionSecret({
      DISTRIBUTION_SESSION_SECRET: SECRET,
      ADMIN_API_SECRET: "admin-secret-value",
    }),
    SECRET,
  );
  assert.equal(
    distributionSessionSecret({ ADMIN_API_SECRET: "admin-secret-value" }),
    "admin-secret-value",
  );
});

test("passwords verify only against the stored salt and hash", async () => {
  const stored = await hashDistributionPassword("research1");
  assert.equal(stored.hash.includes("research1"), false);
  assert.equal(await verifyDistributionPassword("research1", stored.salt, stored.hash), true);
  assert.equal(await verifyDistributionPassword("research2", stored.salt, stored.hash), false);
  assert.equal(await verifyDistributionPassword("research1", stored.salt, "abcd"), false);
});

test("a distribution session names the account only when the signature is current", () => {
  const accountId = randomUUID();
  const now = 1_700_000_000_000;
  const token = createDistributionSessionValue(SECRET, accountId, now);
  assert.equal(readDistributionSessionAccount(token, SECRET, now + 1000), accountId);
  assert.equal(readDistributionSessionAccount(token, "admin-secret-value", now + 1000), null);
  assert.equal(readDistributionSessionAccount(token, SECRET, now + 14 * 24 * 60 * 60 * 1000), null);
  assert.equal(readDistributionSessionAccount(`${token}x`, SECRET, now + 1000), null);
  assert.throws(() => createDistributionSessionValue("short", accountId, now));
});

test("the session cookie is secure on https and on production when the proto is absent", () => {
  assert.equal(distributionCookieSecure("https", "development"), true);
  assert.equal(distributionCookieSecure("http, https", "production"), false);
  assert.equal(distributionCookieSecure(null, "production"), true);
  assert.equal(distributionCookieSecure(null, "development"), false);
});
