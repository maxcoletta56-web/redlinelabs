import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_SESSION_MAX_AGE_SECONDS,
  ADMIN_SESSION_TTL_MS,
  adminSecretMatches,
  adminSessionCookieOptions,
  adminSessionValid,
  authorizeAdmin,
  bearerToken,
  createAdminSessionValue,
} from "./admin-auth.ts";

test("bearer tokens are read case insensitively and trimmed", () => {
  assert.equal(bearerToken("Bearer secret-value"), "secret-value");
  assert.equal(bearerToken("bearer secret-value"), "secret-value");
  assert.equal(bearerToken("  Bearer   secret-value  "), "secret-value");
  assert.equal(bearerToken("Basic secret-value"), "");
  assert.equal(bearerToken("secret-value"), "");
  assert.equal(bearerToken(null), "");
});

test("secrets of different lengths compare without throwing", () => {
  assert.equal(adminSecretMatches("short", "a-much-longer-secret"), false);
  assert.equal(adminSecretMatches("a-much-longer-secret", "short"), false);
  assert.equal(adminSecretMatches("same", "same"), true);
});

test("an unset or blank secret closes the endpoint", () => {
  assert.equal(adminSecretMatches("anything", undefined), false);
  assert.equal(adminSecretMatches("anything", ""), false);
  assert.equal(adminSecretMatches("anything", "   "), false);
  assert.equal(adminSecretMatches("", "configured"), false);
});

test("authorize reads the request header against ADMIN_API_SECRET", () => {
  const request = new Request("https://redlinelabs.shop/api/admin/orders", {
    headers: { authorization: "Bearer top-secret" },
  });
  assert.equal(authorizeAdmin(request, { ADMIN_API_SECRET: "top-secret" }), true);
  assert.equal(authorizeAdmin(request, { ADMIN_API_SECRET: "other-secret" }), false);
  assert.equal(authorizeAdmin(request, {}), false);
  assert.equal(
    authorizeAdmin(new Request("https://redlinelabs.shop/api/admin/orders"), {
      ADMIN_API_SECRET: "top-secret",
    }),
    false,
  );
});

test("session cookie is httpOnly, secure, and strict for twelve hours", () => {
  const now = 1_700_000_000_000;
  const options = adminSessionCookieOptions(now);
  assert.equal(options.httpOnly, true);
  assert.equal(options.secure, true);
  assert.equal(options.sameSite, "strict");
  assert.equal(options.path, "/admin");
  assert.equal(options.maxAge, ADMIN_SESSION_MAX_AGE_SECONDS);
  assert.equal(options.maxAge, 12 * 60 * 60);
  assert.equal(options.expires.getTime(), now + ADMIN_SESSION_TTL_MS);
});

test("session token is a signature, not the raw secret", () => {
  const now = 1_700_000_000_000;
  const token = createAdminSessionValue("top-secret", now);
  assert.equal(token.includes("top-secret"), false);
  assert.equal(adminSessionValid(token, "top-secret", now), true);
  assert.equal(adminSessionValid("top-secret", "top-secret", now), false);
  assert.equal(adminSessionValid(token, "other-secret", now), false);
  assert.equal(adminSessionValid(token, undefined, now), false);
  assert.equal(adminSessionValid(token, "   ", now), false);
  assert.equal(adminSessionValid(undefined, "top-secret", now), false);
  assert.equal(adminSessionValid("", "top-secret", now), false);
});

test("session token expires and a tampered signature is rejected", () => {
  const now = 1_700_000_000_000;
  const token = createAdminSessionValue("top-secret", now);
  assert.equal(adminSessionValid(token, "top-secret", now + ADMIN_SESSION_TTL_MS - 1), true);
  assert.equal(adminSessionValid(token, "top-secret", now + ADMIN_SESSION_TTL_MS), false);

  const [expiresAt, signature] = token.split(".");
  const flipped = `${signature?.startsWith("a") ? "b" : "a"}${signature?.slice(1)}`;
  assert.equal(adminSessionValid(`${expiresAt}.${flipped}`, "top-secret", now), false);
  assert.equal(adminSessionValid(`${Number(expiresAt) + 1000}.${signature}`, "top-secret", now), false);
  assert.equal(adminSessionValid(`${expiresAt}.abcd`, "top-secret", now), false);
  assert.throws(() => createAdminSessionValue("   "), /not configured/);
});
