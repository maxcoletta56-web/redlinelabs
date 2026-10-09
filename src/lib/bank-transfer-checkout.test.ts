import assert from "node:assert/strict";
import test from "node:test";
import type { Sql } from "./db.ts";
import {
  createBankTransferOrder,
  createCheckoutOrder,
  normalizeShipping,
  type BankTransferShippingInput,
} from "./bank-transfer-checkout.ts";
import type { OrderCreatedNotice } from "./mailer.ts";
import {
  authenticateMember,
  joinClub,
  releaseRedemption,
  reserveRedemption,
} from "./club-db.ts";
import { createFakeClubSql, TEST_PROGRAM, TEST_SECRET } from "./club-test-fixtures.ts";

const goodAddress: BankTransferShippingInput = {
  name: "  Ada Lovelace  ",
  line1: "  1 Laboratory Road  ",
  line2: "  Unit 2  ",
  city: "  Sydney  ",
  state: " NSW ",
  postal_code: " 2000 ",
  country: " au ",
};

function payIdEnv() {
  const previous = {
    PAYID_ADDRESS: process.env.PAYID_ADDRESS,
    PAYID_ACCOUNT_NAME: process.env.PAYID_ACCOUNT_NAME,
  };
  process.env.PAYID_ADDRESS = "pay@example.com";
  process.env.PAYID_ACCOUNT_NAME = "Redline Labs";
  return () => {
    if (previous.PAYID_ADDRESS === undefined) delete process.env.PAYID_ADDRESS;
    else process.env.PAYID_ADDRESS = previous.PAYID_ADDRESS;
    if (previous.PAYID_ACCOUNT_NAME === undefined) delete process.env.PAYID_ACCOUNT_NAME;
    else process.env.PAYID_ACCOUNT_NAME = previous.PAYID_ACCOUNT_NAME;
  };
}

function recorder() {
  const calls: { query: string; params?: unknown[] }[] = [];
  const sql: Sql = {
    query: async (query, params) => {
      calls.push({ query, params });
      if (query.startsWith("INSERT")) return [{ reference: params?.[0] }];
      return [];
    },
  };
  return { calls, sql };
}

const orderInput = {
  items: [{ slug: "bpc-157", option: "10", qty: 1 }],
  email: " Ada@Example.com ",
  firstName: "Ada",
  lastName: "Lovelace",
  ageConfirmed: true,
  researchUse: true,
};

test("normalizeShipping rejects a missing or invalid Australian address", () => {
  assert.equal(normalizeShipping(null), null);
  assert.equal(normalizeShipping({ ...goodAddress, line1: "   " }), null);
  assert.equal(normalizeShipping({ ...goodAddress, city: "" }), null);
  assert.equal(normalizeShipping({ ...goodAddress, state: "   " }), null);
  assert.equal(normalizeShipping({ ...goodAddress, postal_code: "12" }), null);
  assert.equal(normalizeShipping({ ...goodAddress, postal_code: "abcd" }), null);
});

test("normalizeShipping trims and caps a valid Australian address", () => {
  const long = "x".repeat(250);
  const normalized = normalizeShipping({
    ...goodAddress,
    name: ` ${"n".repeat(150)} `,
    line1: ` ${long} `,
    line2: long,
    city: ` ${"c".repeat(150)} `,
  });
  assert.ok(normalized);
  assert.equal(normalized?.name.length, 120);
  assert.equal(normalized?.line1.length, 200);
  assert.equal(normalized?.line2.length, 200);
  assert.equal(normalized?.city.length, 120);
  assert.equal(normalized?.state, "NSW");
  assert.equal(normalized?.postcode, "2000");
  assert.equal(normalized?.country, "AU");
  assert.equal(normalized?.line1.startsWith("x"), true);
});

test("createBankTransferOrder refuses to insert when no address is supplied", async () => {
  const restore = payIdEnv();
  const { calls, sql } = recorder();
  try {
    await assert.rejects(
      () =>
        createBankTransferOrder(
          { ...orderInput, shipping: null },
          { sql, deliver: async () => undefined },
        ),
      /A shipping address is required/,
    );
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

test("createBankTransferOrder stores a trimmed address and still succeeds if mail throws", async () => {
  const restore = payIdEnv();
  const { calls, sql } = recorder();
  let mailed: OrderCreatedNotice | null = null;
  try {
    const created = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress },
      {
        sql,
        deliver: async (notice) => {
          mailed = notice;
        },
      },
    );
    assert.match(created.reference, /^RL-[A-Z2-9]{6}$/);
    assert.equal(created.redirectUrl, `/order/${created.reference}`);
    assert.equal(created.totalCents, 8900);
    const insert = calls.find((call) => call.query.startsWith("INSERT"));
    const stored = JSON.parse(String(insert?.params?.[9])) as { line1: string; postcode: string };
    assert.equal(stored.line1, "1 Laboratory Road");
    assert.equal(stored.postcode, "2000");
    assert.equal(mailed?.shipping?.line1, "1 Laboratory Road");
    assert.equal(mailed?.shipping?.city, "Sydney");
    assert.equal(mailed?.email, "ada@example.com");

    const failedMail = recorder();
    const stillCreated = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress },
      {
        sql: failedMail.sql,
        deliver: async () => {
          throw new Error("smtp down");
        },
      },
    );
    assert.match(stillCreated.reference, /^RL-[A-Z2-9]{6}$/);
    assert.equal(
      failedMail.calls.some((call) => call.query.startsWith("INSERT")),
      true,
    );
  } finally {
    restore();
  }
});


const ADA = "ada@example.com";

/** Real club statements against the in-memory tables, with a real member code. */
async function clubFixture(balance: number, program: typeof TEST_PROGRAM | null = TEST_PROGRAM) {
  const db = createFakeClubSql();
  const joined = await joinClub({ email: ADA }, db.sql, undefined, TEST_SECRET);
  const member = db.members.get(ADA);
  if (member) member.balance = balance;
  const code = joined.memberCode ?? "";
  const released: string[] = [];
  return {
    db,
    code,
    released,
    hooks: {
      program,
      allowAttempt: () => ({ ok: true }),
      authenticate: (email: string, candidate: string) =>
        authenticateMember(email, candidate, db.sql, TEST_SECRET),
      reserve: (input: Parameters<typeof reserveRedemption>[0]) => reserveRedemption(input, db.sql),
      release: async (reference: string, note?: string) => {
        released.push(reference);
        return releaseRedemption(reference, note, db.sql);
      },
    },
  };
}

test("club points come off the total, capped to the real balance, and are held under the order reference", async () => {
  const restore = payIdEnv();
  const { calls, sql } = recorder();
  const club = await clubFixture(300);
  try {
    const order = await createBankTransferOrder(
      {
        ...orderInput,
        shipping: goodAddress,
        // Asks for 10,000 points on a 300-point balance.
        club: { email: ADA, code: club.code, points: 10_000 },
      },
      { sql, deliver: async () => {}, club: club.hooks },
    );

    // $89 catalogue line, 300 points = $15 off at the synthetic $5 per 100.
    assert.equal(order.totalCents, 7_400);
    assert.equal(club.db.balance(ADA), 0);
    assert.equal(club.db.ledger.find((l) => l.reason === "redeem")?.orderReference, order.reference);
    assert.equal(club.released.length, 0);

    const insert = calls.find((call) => call.query.startsWith("INSERT"));
    assert.equal(insert?.params?.[0], order.reference);
    assert.equal(insert?.params?.[10], ADA);
    assert.equal(insert?.params?.[11], 300);
    assert.equal(insert?.params?.[12], 1_500);
  } finally {
    restore();
  }
});

test("redemption is whole blocks of 100 points", async () => {
  const restore = payIdEnv();
  const { sql } = recorder();
  const club = await clubFixture(1_000);
  try {
    const order = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress, club: { email: ADA, code: club.code, points: 250 } },
      { sql, deliver: async () => {}, club: club.hooks },
    );
    assert.equal(order.totalCents, 7_900);
    assert.equal(club.db.balance(ADA), 800);
  } finally {
    restore();
  }
});

test("the order always keeps at least AUD $1 payable", async () => {
  const restore = payIdEnv();
  const { sql } = recorder();
  const club = await clubFixture(1_000_000);
  try {
    const order = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress, club: { email: ADA, code: club.code, points: 1_000_000 } },
      { sql, deliver: async () => {}, club: club.hooks },
    );
    assert.ok(order.totalCents >= 100, `payable was ${order.totalCents}`);
    // $89 order: $88 headroom at $5 a block is 17 blocks = $85, leaving $4.
    assert.equal(order.totalCents, 400);
    assert.equal(club.db.balance(ADA), 1_000_000 - 1_700);
  } finally {
    restore();
  }
});

test("a wrong member code pays the full total and spends nothing", async () => {
  const restore = payIdEnv();
  const { sql } = recorder();
  const club = await clubFixture(1_000);
  try {
    const order = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress, club: { email: ADA, code: "RL-AAAAAAAAAA", points: 200 } },
      { sql, deliver: async () => {}, club: club.hooks },
    );
    assert.equal(order.totalCents, 8_900);
    assert.equal(club.db.balance(ADA), 1_000);
    assert.equal(club.db.ledger.filter((l) => l.reason === "redeem").length, 0);
  } finally {
    restore();
  }
});

test("an email that is not a member pays the full total", async () => {
  const restore = payIdEnv();
  const { sql } = recorder();
  const club = await clubFixture(1_000);
  try {
    const order = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress, club: { email: "stranger@example.com", code: club.code, points: 200 } },
      { sql, deliver: async () => {}, club: club.hooks },
    );
    assert.equal(order.totalCents, 8_900);
  } finally {
    restore();
  }
});

test("a balance too small for a block redeems nothing", async () => {
  const restore = payIdEnv();
  const { sql } = recorder();
  const club = await clubFixture(99);
  try {
    const order = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress, club: { email: ADA, code: club.code, points: 100 } },
      { sql, deliver: async () => {}, club: club.hooks },
    );
    assert.equal(order.totalCents, 8_900);
    assert.equal(club.db.balance(ADA), 99);
  } finally {
    restore();
  }
});

test("while the programme is unapproved a redemption request is ignored", async () => {
  const restore = payIdEnv();
  const { sql } = recorder();
  const club = await clubFixture(1_000, null);
  try {
    const order = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress, club: { email: ADA, code: club.code, points: 500 } },
      { sql, deliver: async () => {}, club: club.hooks },
    );
    assert.equal(order.totalCents, 8_900);
    assert.equal(club.db.balance(ADA), 1_000);
  } finally {
    restore();
  }
});

test("checkout without any club input is unchanged", async () => {
  const restore = payIdEnv();
  const { calls, sql } = recorder();
  try {
    const order = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress },
      { sql, deliver: async () => {} },
    );
    assert.equal(order.totalCents, 8_900);
    const insert = calls.find((call) => call.query.startsWith("INSERT"));
    assert.equal(insert?.params?.[10], null);
    assert.equal(insert?.params?.[11], 0);
    assert.equal(insert?.params?.[12], 0);
  } finally {
    restore();
  }
});

test("two checkouts racing on one balance cannot both spend it", async () => {
  const restore = payIdEnv();
  const club = await clubFixture(300);
  try {
    const place = () =>
      createBankTransferOrder(
        { ...orderInput, shipping: goodAddress, club: { email: ADA, code: club.code, points: 300 } },
        { sql: recorder().sql, deliver: async () => {}, club: club.hooks },
      );
    const orders = await Promise.all([place(), place(), place()]);
    const discounted = orders.filter((o) => o.totalCents === 7_400);
    assert.equal(discounted.length, 1);
    assert.equal(orders.filter((o) => o.totalCents === 8_900).length, 2);
    assert.equal(club.db.balance(ADA), 0);
    assert.equal(club.db.ledgerSum(ADA), club.db.balance(ADA) - 300);
  } finally {
    restore();
  }
});

test("held points go back when the order cannot be written", async () => {
  const restore = payIdEnv();
  const failing: Sql = {
    query: async (query) => {
      if (query.startsWith("INSERT INTO orders")) throw new Error("database is down");
      return [];
    },
  };
  const club = await clubFixture(500);
  try {
    await assert.rejects(
      () =>
        createBankTransferOrder(
          { ...orderInput, shipping: goodAddress, club: { email: ADA, code: club.code, points: 200 } },
          { sql: failing, deliver: async () => {}, club: club.hooks },
        ),
      /database is down/,
    );
    assert.equal(club.released.length, 1);
    assert.equal(club.db.balance(ADA), 500);
  } finally {
    restore();
  }
});

test("a club outage never blocks the order", async () => {
  const restore = payIdEnv();
  const { sql } = recorder();
  const club = await clubFixture(500);
  try {
    const order = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress, club: { email: ADA, code: club.code, points: 200 } },
      {
        sql,
        deliver: async () => {},
        club: {
          ...club.hooks,
          reserve: async () => {
            throw new Error("club database is down");
          },
        },
      },
    );
    assert.equal(order.totalCents, 8_900);
  } finally {
    restore();
  }
});

test("a rate-limited credential check pays the full total", async () => {
  const restore = payIdEnv();
  const { sql } = recorder();
  const club = await clubFixture(500);
  try {
    const order = await createBankTransferOrder(
      { ...orderInput, shipping: goodAddress, club: { email: ADA, code: club.code, points: 200 } },
      { sql, deliver: async () => {}, club: { ...club.hooks, allowAttempt: () => ({ ok: false }) } },
    );
    assert.equal(order.totalCents, 8_900);
    assert.equal(club.db.balance(ADA), 500);
  } finally {
    restore();
  }
});

test("a club redemption sent with PayPal is ignored and the charge stays the full total", async () => {
  const { calls, sql } = recorder();
  const club = await clubFixture(1_000);
  const order = await createCheckoutOrder(
    { ...orderInput, shipping: goodAddress, club: { email: ADA, code: club.code, points: 200 } },
    { sql, deliver: async () => {}, club: club.hooks, paymentMethod: "paypal", skipBankConfiguration: true },
  );

  assert.equal(order.paymentMethod, "paypal");
  assert.equal(order.totalCents, 8_900);
  assert.equal(club.db.balance(ADA), 1_000);
  const insert = calls.find((call) => call.query.startsWith("INSERT"));
  assert.equal(insert?.params?.[10], null);
  assert.equal(insert?.params?.[11], 0);
  assert.equal(insert?.params?.[12], 0);
  assert.equal(insert?.params?.[13], "paypal");
});
