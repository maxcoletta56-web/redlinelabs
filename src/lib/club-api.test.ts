import assert from "node:assert/strict";
import test from "node:test";
import {
  INVALID_CREDENTIALS,
  clubAdminReconcilePost,
  clubBalancePost,
  clubJoinPost,
  clubQuotePost,
} from "./club-api.ts";
import { ClubUnavailableError } from "./club-db.ts";
import { TEST_PROGRAM, testMember } from "./club-test-fixtures.ts";

const CODE = "RL-ACDEFGHJKM";

/** A fresh client address per request keeps the client limiter out of the way. */
let clientCounter = 0;

function post(path: string, body: unknown, client?: string) {
  clientCounter += 1;
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": client ?? `10.1.${Math.floor(clientCounter / 250)}.${clientCounter % 250}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const allow = () => ({ ok: true, retryAfterMs: 0 });

test("joining returns the member code to the request that just joined", async () => {
  const response = await clubJoinPost(post("/api/club/join", { email: "join-new@example.com" }), {
    joinClub: async () => ({ member: testMember(), created: true, memberCode: CODE }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.created, true);
  assert.equal(body.memberCode, CODE);
  // No invented bonus is promised.
  assert.equal(body.points, undefined);
});

test("joining with an existing email never reveals the code", async () => {
  const response = await clubJoinPost(post("/api/club/join", { email: "join-old@example.com" }), {
    joinClub: async () => ({ member: testMember(), created: false, memberCode: null }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.created, false);
  assert.equal(body.memberCode, null);
  assert.ok(!JSON.stringify(body).includes("RL-"));
});

test("joining rejects a malformed email or body", async () => {
  const deps = {
    joinClub: async () => {
      throw new Error("should not be called");
    },
  };
  assert.equal((await clubJoinPost(post("/api/club/join", { email: "nope" }), deps)).status, 400);
  assert.equal((await clubJoinPost(post("/api/club/join", "{"), deps)).status, 400);
});

test("joining is rate limited per client and per email", async () => {
  const deps = { joinClub: async () => ({ member: testMember(), created: false as const, memberCode: null }) };
  const statuses: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    statuses.push((await clubJoinPost(post("/api/club/join", { email: `limit${i}@example.com` }, "10.9.9.9"), deps)).status);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);

  const perEmail: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    perEmail.push((await clubJoinPost(post("/api/club/join", { email: "same@example.com" }), deps)).status);
  }
  assert.deepEqual(perEmail, [200, 200, 200, 429]);
  const limited = await clubJoinPost(post("/api/club/join", { email: "same@example.com" }), deps);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
});

test("a missing code secret reports the club as unavailable", async () => {
  const response = await clubJoinPost(post("/api/club/join", { email: "unavail@example.com" }), {
    joinClub: async () => {
      throw new ClubUnavailableError("CLUB_CODE_SECRET must be at least 32 characters");
    },
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(body).includes("CLUB_CODE_SECRET"));
});

test("a balance lookup needs the code and reports tier progress", async () => {
  const response = await clubBalancePost(post("/api/club/balance", { email: "bal@example.com", code: CODE }), {
    program: TEST_PROGRAM,
    allowCredentialAttempt: allow,
    authenticateMember: async () => testMember(),
    listLedger: async () => [
      { id: 1, points: 100, reason: "order", orderReference: "RL-AAAAAA", note: "Test B earn rate", createdAt: null },
    ],
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.member.tier, "Test B");
  assert.equal(body.member.points, 450);
  assert.equal(body.member.pointsValueCents, 2_000);
  assert.equal(body.member.nextTier, "Test C");
  assert.equal(body.ledger.length, 1);
  assert.ok(!JSON.stringify(body).includes(CODE));
});

test("while the programme is unapproved no tier or value is invented", async () => {
  const response = await clubBalancePost(post("/api/club/balance", { email: "bal2@example.com", code: CODE }), {
    program: null,
    allowCredentialAttempt: allow,
    authenticateMember: async () => testMember(),
    listLedger: async () => [],
  });
  const body = await response.json();
  assert.equal(body.member.points, 450);
  assert.equal(body.member.tier, null);
  assert.equal(body.member.pointsValueCents, null);
  assert.equal(body.member.nextTier, null);
});

test("wrong code, unknown email and malformed code are indistinguishable", async () => {
  const deps = { program: TEST_PROGRAM, allowCredentialAttempt: allow, authenticateMember: async () => null };
  const wrongCode = await clubBalancePost(post("/api/club/balance", { email: "bad1@example.com", code: CODE }), deps);
  const unknown = await clubBalancePost(post("/api/club/balance", { email: "bad2@example.com", code: "RL-ZZZZZZZZZZ" }), deps);
  const malformed = await clubBalancePost(post("/api/club/balance", { email: "bad3@example.com", code: "x" }), deps);
  const quote = await clubQuotePost(post("/api/club/quote", { email: "bad4@example.com", code: CODE, payableCents: 5_000 }), deps);

  for (const response of [wrongCode, unknown, malformed, quote]) {
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: INVALID_CREDENTIALS });
  }
});

test("credential attempts are rate limited per client", async () => {
  const deps = { program: TEST_PROGRAM, allowCredentialAttempt: allow, authenticateMember: async () => null };
  const statuses: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    const response = await clubBalancePost(
      post("/api/club/balance", { email: `rl${i}@example.com`, code: CODE }, "10.8.8.8"),
      deps,
    );
    statuses.push(response.status);
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
  assert.deepEqual(statuses.slice(10), [429, 429]);
});

test("credential attempts are rate limited per email across clients", async () => {
  let calls = 0;
  const deps = {
    program: TEST_PROGRAM,
    authenticateMember: async () => {
      calls += 1;
      return null;
    },
  };
  const statuses: number[] = [];
  for (let i = 0; i < 22; i += 1) {
    statuses.push(
      (await clubBalancePost(post("/api/club/balance", { email: "victim@example.com", code: CODE }), deps)).status,
    );
  }
  assert.deepEqual(statuses.slice(0, 20), Array(20).fill(401));
  assert.deepEqual(statuses.slice(20), [429, 429]);
  assert.equal(calls, 20);
});

test("a malformed lookup is a 400, not a credential oracle", async () => {
  const response = await clubBalancePost(post("/api/club/balance", { email: "nope", code: "" }), {
    program: TEST_PROGRAM,
    authenticateMember: async () => testMember(),
  });
  assert.equal(response.status, 400);
});

test("a checkout quote caps the points to what the order can absorb", async () => {
  const response = await clubQuotePost(
    post("/api/club/quote", { email: "quote@example.com", code: CODE, payableCents: 2_000 }),
    { program: TEST_PROGRAM, allowCredentialAttempt: allow, authenticateMember: async () => testMember() },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  // $20 order, $1 must stay payable: 300 points at $5 per 100, not the full 450.
  assert.equal(body.maxPoints, 300);
  assert.equal(body.maxDiscountCents, 1_500);
  assert.equal(body.step, 100);
});

test("a quote for a tiny order offers nothing", async () => {
  const response = await clubQuotePost(
    post("/api/club/quote", { email: "quote2@example.com", code: CODE, payableCents: 550 }),
    { program: TEST_PROGRAM, allowCredentialAttempt: allow, authenticateMember: async () => testMember() },
  );
  assert.equal((await response.json()).maxPoints, 0);
});

test("with the programme unapproved the quote offers no redemption and checks nothing", async () => {
  let authenticated = false;
  const response = await clubQuotePost(
    post("/api/club/quote", { email: "quote3@example.com", code: CODE, payableCents: 9_000 }),
    {
      program: null,
      authenticateMember: async () => {
        authenticated = true;
        return testMember();
      },
    },
  );
  const body = await response.json();
  assert.equal(body.enabled, false);
  assert.equal(body.maxPoints, 0);
  assert.equal(authenticated, false);
});

test("the reconcile endpoint needs the admin secret", async () => {
  const previous = process.env.ADMIN_API_SECRET;
  process.env.ADMIN_API_SECRET = "admin-secret-for-tests";
  try {
    const denied = await clubAdminReconcilePost(post("/api/admin/club/reconcile", {}), {
      reconcileClub: async () => {
        throw new Error("must not run");
      },
    });
    assert.equal(denied.status, 401);

    const summary = { enabled: true, awardedOrders: ["RL-AAAAAA"], releasedOrders: [], failures: [] };
    const request = new Request("http://localhost/api/admin/club/reconcile", {
      method: "POST",
      headers: { authorization: ["Bearer", process.env.ADMIN_API_SECRET].join(" "), "content-type": "application/json" },
      body: "{}",
    });
    const ok = await clubAdminReconcilePost(request, { reconcileClub: async () => summary });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), summary);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_API_SECRET;
    else process.env.ADMIN_API_SECRET = previous;
  }
});
