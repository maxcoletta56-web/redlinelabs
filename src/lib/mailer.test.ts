import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentReceivedEmail, sendPaymentReceivedEmail } from "./mailer.ts";

test("the paid confirmation names the order and the amount", () => {
  const email = buildPaymentReceivedEmail({
    reference: "RL-234567",
    firstName: "Ada",
    email: "ada@example.com",
    totalCents: 18_000,
    orderUrl: "https://redlinelabs.shop/order/RL-234567",
  });
  assert.equal(email.to, "ada@example.com");
  assert.match(email.subject, /RL-234567/);
  assert.match(email.text, /\$180\.00 AUD/);
  assert.match(email.text, /queued for dispatch/);
  assert.doesNotMatch(email.html, /WHOP_API_KEY|sk_|ws_/);
});

test("a missing Resend key does not call the network", async () => {
  let called = false;
  const result = await sendPaymentReceivedEmail(
    {
      reference: "RL-234567",
      firstName: "Ada",
      email: "ada@example.com",
      totalCents: 18_000,
    },
    { RESEND_API_KEY: "", ORDER_EMAIL_FROM: "Redline Labs <orders@redlinelabs.shop>" },
    async () => {
      called = true;
      return new Response(null, { status: 500 });
    },
  );
  assert.equal(result, "unconfigured");
  assert.equal(called, false);
});

test("a Resend acceptance is sent and the key stays out of the body", async () => {
  let authorization = "";
  let body = "";
  const result = await sendPaymentReceivedEmail(
    {
      reference: "RL-234567",
      firstName: "Ada",
      email: "ada@example.com",
      totalCents: 18_000,
    },
    {
      RESEND_API_KEY: "re_test_secret_value",
      ORDER_EMAIL_FROM: "Redline Labs <orders@redlinelabs.shop>",
      NEXT_PUBLIC_SITE_URL: "https://redlinelabs.shop",
    },
    async (_url, init) => {
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      body = String(init?.body ?? "");
      return new Response("{}", { status: 200 });
    },
  );
  assert.equal(result, "sent");
  assert.equal(authorization, "Bearer re_test_secret_value");
  assert.equal(body.includes("re_test_secret_value"), false);
  assert.match(body, /RL-234567/);
});
