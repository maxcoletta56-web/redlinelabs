import assert from "node:assert/strict";
import test from "node:test";
import { adminSecretMatches, authorizeAdmin, bearerToken } from "./admin-auth.ts";

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
