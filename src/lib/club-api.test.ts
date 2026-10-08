import assert from "node:assert/strict";
import test from "node:test";
import { clubBalancePost, clubJoinPost, clubQuotePost } from "./club-api.ts";
import type { ClubMember } from "./club-db.ts";

function member(overrides: Partial<ClubMember> = {}): ClubMember {
  return {
    email: "ada@example.com",
    firstName: "Ada",
    memberCode: "RL-ACDEFG",
    pointsBalance: 450,
    lifetimeSpendCents: 60_000,
    firstOrderBonusAt: null,
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

/** A fresh client address per test keeps the rate limiter out of the way. */
let clientCounter = 0;

function post(path: string, body: unknown) {
  clientCounter += 1;
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.0.0.${clientCounter}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("joining returns the member code only to the browser that just joined", async () => {
  const response = await clubJoinPost(post("/api/club/join", { email: "ada@example.com" }), {
    joinClub: async () => ({ member: member(), created: true }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.created, true);
  assert.equal(body.memberCode, "RL-ACDEFG");
  assert.equal(body.points, 100);
  assert.equal(body.pointsValueCents, 500);
});

test("joining with an email that is already a member never reveals the code", async () => {
  const response = await clubJoinPost(post("/api/club/join", { email: "ada@example.com" }), {
    joinClub: async () => ({ member: member(), created: false }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.created, false);
  assert.equal(body.memberCode, null);
  assert.ok(!JSON.stringify(body).includes("ACDEFG"));
});

test("joining rejects a malformed email", async () => {
  const response = await clubJoinPost(post("/api/club/join", { email: "nope" }), {
    joinClub: async () => {
      throw new Error("should not be called");
    },
  });
  assert.equal(response.status, 400);
});

test("a balance lookup needs a matching code and reports tier progress", async () => {
  const response = await clubBalancePost(
    post("/api/club/balance", { email: "ada@example.com", code: "RL-ACDEFG" }),
    {
      authenticateMember: async () => member(),
      listLedger: async () => [
        {
          id: 1,
          points: 100,
          reason: "join",
          orderReference: null,
          note: "Welcome points",
          createdAt: "2026-10-01T00:00:00Z",
        },
      ],
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.member.tier, "Silver");
  assert.equal(body.member.points, 450);
  assert.equal(body.member.pointsValueCents, 2_250);
  assert.equal(body.member.nextTier, "Gold");
  assert.equal(body.member.nextTierRemainingCents, 40_000);
  assert.equal(body.ledger.length, 1);
  // The code is never echoed back.
  assert.ok(!JSON.stringify(body).includes("ACDEFG"));
});

test("a wrong code and an unknown email give the same answer", async () => {
  const response = await clubBalancePost(
    post("/api/club/balance", { email: "ada@example.com", code: "RL-ACDEFH" }),
    { authenticateMember: async () => null },
  );
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error, "That email and member code do not match a membership");
});

test("a checkout quote caps the points to what the order can absorb", async () => {
  const response = await clubQuotePost(
    post("/api/club/quote", {
      email: "ada@example.com",
      code: "RL-ACDEFG",
      payableCents: 2_000,
    }),
    { authenticateMember: async () => member() },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  // $20 order, $1 must stay payable: 300 points, not the full 450.
  assert.equal(body.maxPoints, 300);
  assert.equal(body.maxDiscountCents, 1_500);
  assert.equal(body.step, 100);
});

test("the quote endpoint refuses a request with no code", async () => {
  const response = await clubQuotePost(
    post("/api/club/quote", { email: "ada@example.com", payableCents: 5_000 }),
    { authenticateMember: async () => member() },
  );
  assert.equal(response.status, 400);
});

test("a malformed body is rejected rather than throwing", async () => {
  const response = await clubJoinPost(post("/api/club/join", "{"), {
    joinClub: async () => ({ member: member(), created: true }),
  });
  assert.equal(response.status, 400);
});
