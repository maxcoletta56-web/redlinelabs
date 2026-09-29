import assert from "node:assert/strict";
import test from "node:test";
import { COMPANY_EMAIL, RESEARCH_DISCLAIMER } from "./company.ts";
import {
  buildCustomerOrderEmail,
  buildMerchantOrderEmail,
  buildPaymentReceivedEmail,
  formatAudFromCents,
  merchantNotifyEmail,
  resetMailerForTests,
  sendEmail,
  sendOrderCreatedEmails,
  sendPaymentReceivedEmail,
  type OrderConfirmationInput,
} from "./mailer.ts";

const confirmation: OrderConfirmationInput = {
  reference: "RL-7F3K2Q",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  items: [
    { name: "BPC-157 (10mg)", qty: 2, unitAmountCents: 2000 },
    { name: "BAC Water <5ml>", qty: 1, unitAmountCents: 1500 },
  ],
  subtotalCents: 5500,
  totalCents: 4400,
  promoCode: "DGC20",
  payId: "pay@redlinelabs.shop",
  accountName: "Redline Labs Pty Ltd",
  orderUrl: "https://redlinelabs.shop/order/RL-7F3K2Q",
};

test("formats order totals in dollars from cents", () => {
  assert.equal(formatAudFromCents(0), "$0.00");
  assert.equal(formatAudFromCents(95), "$0.95");
  assert.equal(formatAudFromCents(2000), "$20.00");
  assert.equal(formatAudFromCents(4400), "$44.00");
  assert.equal(formatAudFromCents(123456), "$1,234.56");
});

test("customer order email includes the PayID instructions and the research line", () => {
  const email = buildCustomerOrderEmail(confirmation);

  assert.equal(email.to, "ada@example.com");
  assert.equal(email.subject, "Order RL-7F3K2Q — $44.00 AUD awaiting payment");
  assert.match(email.text, /2 × BPC-157 \(10mg\) — \$20\.00 each — \$40\.00/);
  assert.match(email.text, /1 × BAC Water <5ml> — \$15\.00 each — \$15\.00/);
  assert.match(email.text, /Total: \$44\.00 AUD/);
  assert.match(email.text, /PayID: pay@redlinelabs.shop/);
  assert.match(email.text, /Account name: Redline Labs Pty Ltd/);
  assert.match(email.text, /Transfer description: RL-7F3K2Q/);
  assert.match(email.text, /Put the reference in the transfer description/);
  assert.match(email.text, /Promo code DGC20/);
  assert.ok(email.text.includes(RESEARCH_DISCLAIMER));
  assert.ok(email.text.includes(COMPANY_EMAIL));
  assert.match(email.text, /https:\/\/redlinelabs\.shop\/order\/RL-7F3K2Q/);

  assert.match(email.html, /<table/i);
  assert.match(email.html, /#050505/);
  assert.match(email.html, /#d4af37/);
  assert.match(email.html, /pay@redlinelabs\.shop/);
  assert.match(email.html, /Redline Labs Pty Ltd/);
  assert.match(email.html, /RL-7F3K2Q/);
  assert.match(email.html, /Put the reference in the transfer description/);
  assert.match(email.html, /\$44\.00 AUD/);
  assert.ok(email.html.includes(COMPANY_EMAIL));
  assert.equal(email.html.includes("<img"), false);
  assert.equal(email.html.includes("<link"), false);
  assert.equal(email.html.includes("BAC Water &lt;5ml&gt;"), true);
  assert.equal(email.html.includes("BAC Water <5ml>"), false);
});

test("order emails include the ship-to lines and stay safe without an address", () => {
  const shipping = {
    line1: "1 Laboratory Road <dock>",
    line2: "Unit 2",
    city: "Sydney",
    state: "NSW",
    postcode: "2000",
    country: "AU",
  };
  const customer = buildCustomerOrderEmail({ ...confirmation, shipping });
  assert.match(customer.text, /Ship to:/);
  assert.match(customer.text, /1 Laboratory Road <dock>/);
  assert.match(customer.text, /Unit 2/);
  assert.match(customer.text, /Sydney NSW 2000/);
  assert.match(customer.text, /\nAU/);
  assert.match(customer.html, /1 Laboratory Road &lt;dock&gt;/);
  assert.equal(customer.html.includes("1 Laboratory Road <dock>"), false);
  assert.match(customer.html, /Unit 2/);
  assert.match(customer.html, /Sydney NSW 2000<br>AU/);

  const merchant = buildMerchantOrderEmail({
    ...confirmation,
    shipping,
    notifyEmail: "ops@redlinelabs.shop",
  });
  assert.match(merchant.text, /Ship to:/);
  assert.match(merchant.text, /1 Laboratory Road/);
  assert.match(merchant.text, /Sydney NSW 2000/);
  assert.match(merchant.html, /1 Laboratory Road/);

  const missing = buildCustomerOrderEmail({ ...confirmation, shipping: null });
  assert.match(missing.text, /No address on file/);
  assert.match(missing.html, /No address on file/);
  const merchantMissing = buildMerchantOrderEmail({
    ...confirmation,
    shipping: null,
    notifyEmail: "ops@redlinelabs.shop",
  });
  assert.match(merchantMissing.text, /No address on file/);
});

test("merchant email subject carries the reference and the dollar total", () => {
  const email = buildMerchantOrderEmail({
    ...confirmation,
    notifyEmail: "ops@redlinelabs.shop",
  });

  assert.equal(email.to, "ops@redlinelabs.shop");
  assert.equal(email.subject, "New order RL-7F3K2Q — $44.00 AUD");
  assert.match(email.text, /Ada Lovelace/);
  assert.match(email.text, /ada@example\.com/);
  assert.match(email.text, /Promo code: DGC20/);
  assert.match(email.text, /2 × BPC-157 \(10mg\)/);
  assert.match(email.text, /Total: \$44\.00 AUD/);
  assert.match(email.text, /https:\/\/redlinelabs\.shop\/order\/RL-7F3K2Q/);
  assert.match(email.html, /<table/i);
});

test("merchant email omits the promo line when there is no code", () => {
  const email = buildMerchantOrderEmail({
    ...confirmation,
    promoCode: null,
    totalCents: 5500,
    notifyEmail: "ops@redlinelabs.shop",
  });

  assert.equal(email.subject, "New order RL-7F3K2Q — $55.00 AUD");
  assert.equal(email.text.includes("Promo code"), false);
  assert.equal(email.html.includes("Promo code"), false);
  assert.match(email.text, /Total: \$55\.00 AUD/);
});

test("payment received email states the dollar amount", () => {
  const email = buildPaymentReceivedEmail({
    reference: "RL-7F3K2Q",
    firstName: "Ada",
    email: "ada@example.com",
    totalCents: 4400,
    orderUrl: "https://redlinelabs.shop/order/RL-7F3K2Q",
  });

  assert.equal(email.subject, "Payment received for order RL-7F3K2Q");
  assert.match(email.text, /\$44\.00 AUD/);
  assert.match(email.text, /RL-7F3K2Q/);
  assert.match(email.text, /queued for dispatch/);
  assert.ok(email.text.includes(COMPANY_EMAIL));
  assert.match(email.html, /<table/i);
  assert.match(email.html, /#050505/);
});

test("merchant copy defaults to the PayID address", () => {
  assert.equal(merchantNotifyEmail({ ORDER_NOTIFY_EMAIL: " ops@shop.test " }), "ops@shop.test");
  assert.equal(merchantNotifyEmail({ PAYID_ADDRESS: " pay@shop.test " }), "pay@shop.test");
  assert.equal(
    merchantNotifyEmail({ ORDER_NOTIFY_EMAIL: "ops@shop.test", PAYID_ADDRESS: "pay@shop.test" }),
    "ops@shop.test",
  );
  assert.equal(merchantNotifyEmail({}), "");
});

test("a missing Resend key is a no-op that logs once and never throws", async () => {
  resetMailerForTests();
  const warnings: string[] = [];
  let fetches = 0;
  const hooks = {
    warn: (message: string) => {
      warnings.push(message);
    },
    fetchImpl: async () => {
      fetches += 1;
      throw new Error("Resend must not be called");
    },
  };

  const env = {
    PAYID_ADDRESS: "pay@redlinelabs.shop",
    PAYID_ACCOUNT_NAME: "Redline Labs Pty Ltd",
    ORDER_EMAIL_FROM: "Redline Labs <orders@redlinelabs.shop>",
  };
  const notice = {
    reference: confirmation.reference,
    firstName: confirmation.firstName,
    lastName: confirmation.lastName,
    email: confirmation.email,
    items: confirmation.items,
    subtotalCents: confirmation.subtotalCents,
    totalCents: confirmation.totalCents,
    promoCode: confirmation.promoCode,
  };

  await sendEmail(
    { to: "ada@example.com", subject: "Hello", text: "Hello", html: "<p>Hello</p>" },
    {},
    hooks,
  );
  await sendOrderCreatedEmails(notice, env, hooks);
  await sendOrderCreatedEmails(notice, { ...env, RESEND_API_KEY: "   " }, hooks);
  await sendPaymentReceivedEmail(
    {
      reference: notice.reference,
      firstName: notice.firstName,
      email: notice.email,
      totalCents: notice.totalCents,
    },
    env,
    hooks,
  );

  assert.equal(fetches, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0] ?? "", /RESEND_API_KEY/);
});

test("a Resend failure is logged without the API key and does not reject", async () => {
  const logged: string[] = [];
  const requests: { url: string; authorization: string; body: string }[] = [];
  const hooks = {
    fetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("authorization") ?? "",
        body: String(init?.body ?? ""),
      });
      return new Response("nope", { status: 502 });
    },
    onError: (message: string, detail: { errorMessage: string }) => {
      logged.push(`${message} ${detail.errorMessage}`);
    },
  };
  const env = {
    RESEND_API_KEY: "re_test_secret_value",
    ORDER_EMAIL_FROM: "Redline Labs <orders@redlinelabs.shop>",
    ORDER_NOTIFY_EMAIL: "ops@redlinelabs.shop",
    PAYID_ADDRESS: "pay@redlinelabs.shop",
    PAYID_ACCOUNT_NAME: "Redline Labs Pty Ltd",
  };

  await sendOrderCreatedEmails(
    {
      reference: confirmation.reference,
      firstName: confirmation.firstName,
      lastName: confirmation.lastName,
      email: confirmation.email,
      items: confirmation.items,
      subtotalCents: confirmation.subtotalCents,
      totalCents: confirmation.totalCents,
      promoCode: confirmation.promoCode,
    },
    env,
    hooks,
  );
  await sendPaymentReceivedEmail(
    {
      reference: confirmation.reference,
      firstName: confirmation.firstName,
      email: confirmation.email,
      totalCents: confirmation.totalCents,
    },
    env,
    hooks,
  );

  assert.equal(logged.length, 3);
  assert.equal(requests.length, 3);
  assert.ok(requests.every((request) => request.url === "https://api.resend.com/emails"));
  assert.ok(requests.every((request) => request.authorization === "Bearer re_test_secret_value"));
  assert.equal(logged.some((line) => line.includes("re_test_secret_value")), false);
  assert.equal(requests.some((request) => request.body.includes("re_test_secret_value")), false);
  assert.match(logged.join("\n"), /HTTP 502/);
});
