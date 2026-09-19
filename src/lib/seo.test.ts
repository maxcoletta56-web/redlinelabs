import assert from "node:assert/strict";
import test from "node:test";
import { metaDescription } from "./seo.ts";

test("keeps a complete first sentence when it fits", () => {
  assert.equal(
    metaDescription(
      "Laboratory research chemicals shipped within Australia. For laboratory research use only.",
    ),
    "Laboratory research chemicals shipped within Australia.",
  );
});

test("truncates on a word boundary instead of mid-word", () => {
  const long =
    "This listing is a topical research formulation containing GHK copper tripeptide chelate, sodium hyaluronate, panthenol, and astaxanthin as labelled by the supplier.";
  const result = metaDescription(long);
  assert.ok(result.endsWith("…"));
  assert.ok(result.length <= 155);
  assert.equal(result.includes("supplier"), false);
});
