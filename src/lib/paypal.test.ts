import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaypalOrder,
  confirmPaypalOrder,
  createPaypalOrder,
  isPaypalApprovalUrl,
  parsePaypalOrder,
  paypalApprovalUrl,
  paypalMoney,
  paypalOrderIsPaid,
  paypalOrderMatches,
  resolvePaypal,
} from "./paypal.ts";

const orderId = "5O190127TN364715T";
const transactionId = "rl_abc123def456";

const orderInput = {
  transactionId,
  amountCents: 1600,
  subtotalCents: 2000,
  discountCents: 400,
  lines: [
    { name: "BPC-157", sku: "BPC-10", qty: 2, unitAmountCents: 1000 },
  ],
  shipping: {
    name: "Max Coletta",
    line1: "1 Research St",
    city: "Sydney",
    state: "NSW",
    postalCode: "2000",
    countryCode: "AU" as const,
  },
  email: "max@example.com",
  firstName: "Max",
  lastName: "Coletta",
  returnUrl: "https://redlinelabs.shop/checkout/success?session_id=rl_abc123def456",
  cancelUrl: "https://redlinelabs.shop/checkout",
  brandName: "Redline Labs",
};

test("requires a client id and secret", () => {
  assert.equal(resolvePaypal({}), undefined);
  assert.equal(resolvePaypal({ PAYPAL_CLIENT_ID: "client" }), undefined);
  const resolved = resolvePaypal({
    PAYPAL_CLIENT_ID: " client ",
    PAYPAL_CLIENT_SECRET: " secret ",
  });
  assert.deepEqual(resolved, {
    clientId: "client",
    clientSecret: "secret",
    mode: "sandbox",
  });
});

test("production uses the live PayPal API", () => {
  const resolved = resolvePaypal({
    VERCEL_ENV: "production",
    PAYPAL_CLIENT_ID: "client",
    PAYPAL_CLIENT_SECRET: "secret",
  });
  assert.equal(resolved?.mode, "live");
  assert.equal(
    resolvePaypal({
      VERCEL_ENV: "production",
      PAYPAL_ENV: "sandbox",
      PAYPAL_CLIENT_ID: "client",
      PAYPAL_CLIENT_SECRET: "secret",
    }),
    undefined,
  );
});

test("card checkout opens PayPal guest card collection", () => {
  const body = buildPaypalOrder(orderInput);
  assert.equal(body.intent, "CAPTURE");
  assert.equal(body.payment_source.paypal.experience_context.landing_page, "GUEST_CHECKOUT");
  assert.equal(body.payment_source.paypal.experience_context.user_action, "PAY_NOW");
  assert.equal(body.purchase_units[0]?.amount.value, "16.00");
  assert.equal(body.purchase_units[0]?.amount.currency_code, "AUD");
  assert.equal(body.purchase_units[0]?.amount.breakdown.item_total.value, "20.00");
  assert.equal(body.purchase_units[0]?.amount.breakdown.discount?.value, "4.00");
  assert.equal(body.purchase_units[0]?.invoice_id, transactionId);
  assert.equal(body.purchase_units[0]?.shipping.address.country_code, "AU");
  assert.equal(paypalMoney(1999), "19.99");
  assert.throws(() => paypalMoney(0), /greater than zero/);
});

test("approval links must be the PayPal card checkout for this order", () => {
  const approval = `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`;
  assert.equal(isPaypalApprovalUrl(approval, "sandbox", orderId), true);
  assert.equal(isPaypalApprovalUrl(approval, "live", orderId), false);
  assert.equal(
    isPaypalApprovalUrl("https://evil.example/checkoutnow?token=" + orderId, "sandbox", orderId),
    false,
  );
  assert.equal(
    isPaypalApprovalUrl(
      `https://www.sandbox.paypal.com/checkoutnow?token=OTHERORDER1234`,
      "sandbox",
      orderId,
    ),
    false,
  );
  assert.equal(
    paypalApprovalUrl(
      { links: [{ rel: "payer-action", href: approval }] },
      "sandbox",
      orderId,
    ),
    approval,
  );
  assert.throws(
    () => paypalApprovalUrl({ links: [{ rel: "payer-action", href: "https://evil.example" }] }, "sandbox", orderId),
    /card checkout/,
  );
});

test("a captured order is paid only when the amount and transaction match", () => {
  const order = parsePaypalOrder({
    id: orderId,
    status: "COMPLETED",
    purchase_units: [
      {
        custom_id: transactionId,
        invoice_id: transactionId,
        amount: { currency_code: "AUD", value: "16.00" },
        payments: {
          captures: [
            { status: "COMPLETED", amount: { currency_code: "AUD", value: "16.00" } },
          ],
        },
      },
    ],
  });
  const expected = { orderId, transactionId, amount: "16.00" };
  assert.equal(paypalOrderMatches(order, expected), true);
  assert.equal(paypalOrderIsPaid(order, expected), true);
  assert.equal(paypalOrderIsPaid(order, { ...expected, amount: "1.00" }), false);

  const mismatched = parsePaypalOrder({
    id: orderId,
    status: "COMPLETED",
    purchase_units: [
      {
        custom_id: transactionId,
        invoice_id: "rl_other",
        amount: { currency_code: "AUD", value: "16.00" },
      },
    ],
  });
  assert.equal(mismatched.transactionId, null);
  assert.equal(paypalOrderIsPaid(mismatched, expected), false);
});

test("checkout calls PayPal and captures only a matching approved order", async () => {
  const original = globalThis.fetch;
  const approval = `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`;
  const calls: string[] = [];
  const config = { clientId: "client", clientSecret: "secret", mode: "sandbox" as const };

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url}`);
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
    }
    if (method === "POST" && url.endsWith("/v2/checkout/orders")) {
      return new Response(
        JSON.stringify({
          id: orderId,
          status: "CREATED",
          links: [{ rel: "payer-action", href: approval }],
        }),
        { status: 200 },
      );
    }
    if (method === "GET" && url.endsWith(`/v2/checkout/orders/${orderId}`)) {
      return new Response(
        JSON.stringify({
          id: orderId,
          status: "APPROVED",
          purchase_units: [
            {
              custom_id: transactionId,
              invoice_id: transactionId,
              amount: { currency_code: "AUD", value: "16.00" },
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (method === "POST" && url.endsWith("/capture")) {
      return new Response(
        JSON.stringify({
          id: orderId,
          status: "COMPLETED",
          purchase_units: [
            {
              custom_id: transactionId,
              invoice_id: transactionId,
              amount: { currency_code: "AUD", value: "16.00" },
              payments: {
                captures: [
                  { status: "COMPLETED", amount: { currency_code: "AUD", value: "16.00" } },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response("unexpected", { status: 500 });
  };

  try {
    const created = await createPaypalOrder(config, buildPaypalOrder(orderInput), transactionId);
    assert.equal(created.id, orderId);
    assert.equal(created.approvalUrl, approval);
    const confirmed = await confirmPaypalOrder(config, orderId, {
      transactionId,
      amount: "16.00",
    });
    assert.equal(confirmed.paid, true);
    assert.equal(
      calls.includes("POST https://api-m.sandbox.paypal.com/v2/checkout/orders"),
      true,
    );
    assert.equal(
      calls.includes(`POST https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`),
      true,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("a different PayPal amount is not captured", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url}`);
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        id: orderId,
        status: "APPROVED",
        purchase_units: [
          {
            custom_id: transactionId,
            invoice_id: transactionId,
            amount: { currency_code: "AUD", value: "99.00" },
          },
        ],
      }),
      { status: 200 },
    );
  };

  try {
    await assert.rejects(
      () =>
        confirmPaypalOrder(
          { clientId: "client", clientSecret: "secret", mode: "sandbox" },
          orderId,
          { transactionId, amount: "16.00" },
        ),
      /confirm this payment/,
    );
    assert.equal(calls.some((call) => call.includes("/capture")), false);
  } finally {
    globalThis.fetch = original;
  }
});
