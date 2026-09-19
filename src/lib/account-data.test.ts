import assert from "node:assert/strict";
import test from "node:test";
import {
  addAddress,
  addStockAlert,
  createUser,
  defaultAddress,
  grantStoreCredit,
  hasStockAlert,
  lineDisplayName,
  publicAccount,
  recordOrder,
  removeAddress,
  removeStockAlert,
  setDefaultAddress,
  updateAddress,
  validateAddress,
  validateSignup,
  verifyPassword,
  type AccountUser,
  type OrderRecord,
} from "./account-data.ts";

async function sampleUser(): Promise<AccountUser> {
  return createUser(
    {
      email: "max@example.com",
      password: "research1",
      firstName: "Max",
      lastName: "Cole",
    },
    "2026-09-17T00:00:00.000Z",
  );
}

const labAddress = {
  label: "Lab",
  firstName: "Max",
  lastName: "Cole",
  line1: "12 Research Ave",
  city: "Melbourne",
  state: "VIC",
  postcode: "3000",
};

test("shows size units on order history lines", () => {
  assert.equal(
    lineDisplayName({
      slug: "bpc-157",
      name: "BPC-157",
      option: "10",
      variantLabel: "MG",
      sku: "BPC157",
      qty: 1,
      unitAmountCents: 8900,
    }),
    "BPC-157 (10 MG)",
  );
});

test("rejects incomplete signup details", () => {
  assert.equal(
    validateSignup({
      email: "not-an-email",
      password: "research1",
      firstName: "Max",
      lastName: "Cole",
    }),
    "Enter a valid email address",
  );
  assert.equal(
    validateSignup({
      email: "max@example.com",
      password: "short",
      firstName: "Max",
      lastName: "Cole",
    }),
    "Password must be at least 8 characters",
  );
});

test("hashes passwords and omits them from the public profile", async () => {
  const user = await sampleUser();
  assert.equal(await verifyPassword(user, "research1"), true);
  assert.equal(await verifyPassword(user, "wrong-pass"), false);
  const published = publicAccount(user);
  assert.equal("passwordHash" in published, false);
  assert.equal("salt" in published, false);
  assert.equal(published.email, "max@example.com");
});

test("validates Australian addresses", () => {
  assert.equal(validateAddress({ ...labAddress, postcode: "300" }), "Enter a 4-digit Australian postcode");
  assert.equal(validateAddress({ ...labAddress, state: "CA" }), "Select an Australian state or territory");
  assert.equal(validateAddress(labAddress), null);
});

test("keeps a single default saved address", async () => {
  let user = addAddress(await sampleUser(), labAddress, "addr-lab");
  user = addAddress(
    user,
    { ...labAddress, label: "Warehouse", line1: "9 Dock Rd", isDefault: true },
    "addr-wh",
  );
  assert.equal(defaultAddress(user)?.id, "addr-wh");
  assert.equal(user.addresses.filter((address) => address.isDefault).length, 1);

  user = setDefaultAddress(user, "addr-lab");
  assert.equal(defaultAddress(user)?.id, "addr-lab");

  user = updateAddress(user, "addr-lab", { ...labAddress, line1: "14 Research Ave" });
  assert.equal(defaultAddress(user)?.line1, "14 Research Ave");

  user = removeAddress(user, "addr-lab");
  assert.equal(defaultAddress(user)?.id, "addr-wh");
  assert.equal(user.addresses.length, 1);
});

test("toggles stock alerts without duplicating a listing", async () => {
  let user = addStockAlert(
    await sampleUser(),
    { slug: "bpc-157", name: "BPC-157", sku: "Bpc157" },
    "2026-09-17T00:00:00.000Z",
  );
  user = addStockAlert(user, { slug: "bpc-157", name: "BPC-157", sku: "Bpc157" });
  assert.equal(user.stockAlerts.length, 1);
  assert.equal(hasStockAlert(user, "bpc-157"), true);
  user = removeStockAlert(user, "bpc-157");
  assert.equal(hasStockAlert(user, "bpc-157"), false);
});

test("records each paid order once and keeps history newest first", async () => {
  const order = (id: string, session: string): OrderRecord => ({
    id,
    stripeSessionId: session,
    createdAt: "2026-09-17T00:00:00.000Z",
    email: "max@example.com",
    status: "processing",
    items: [
      {
        slug: "bpc-157",
        name: "BPC-157",
        option: "10",
        sku: "Bpc10",
        qty: 1,
        unitAmountCents: 8900,
      },
    ],
    subtotalCents: 8900,
    storeCreditCents: 0,
    totalCents: 8900,
    currency: "aud",
    trackingNumber: null,
    trackingUrl: null,
    shipping: null,
  });

  let user = recordOrder(await sampleUser(), order("RL-1", "cs_1"));
  user = recordOrder(user, order("RL-1", "cs_1"));
  user = recordOrder(user, order("RL-2", "cs_1"));
  user = recordOrder(user, order("RL-3", "cs_3"));
  assert.deepEqual(
    user.orders.map((entry) => entry.id),
    ["RL-3", "RL-1"],
  );
});

test("debits only the store credit recorded on the paid order", async () => {
  let user = grantStoreCredit(await sampleUser(), 2000, "Batch adjustment");
  const paid: OrderRecord = {
    id: "RL-CREDIT",
    stripeSessionId: "cs_credit",
    createdAt: "2026-09-17T00:00:00.000Z",
    email: "max@example.com",
    status: "processing",
    items: [
      {
        slug: "bpc-157",
        name: "BPC-157",
        option: "10",
        sku: "Bpc10",
        qty: 1,
        unitAmountCents: 8900,
      },
    ],
    subtotalCents: 8900,
    storeCreditCents: 1000,
    totalCents: 7900,
    currency: "aud",
    trackingNumber: "ABC123",
    trackingUrl: null,
    shipping: null,
  };
  user = recordOrder(user, paid);
  assert.equal(user.storeCreditCents, 1000);
  assert.equal(user.orders[0]?.trackingNumber, "ABC123");
  assert.equal(user.creditLedger[0]?.amountCents, -1000);
});
