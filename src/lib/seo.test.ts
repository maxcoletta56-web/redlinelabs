import assert from "node:assert/strict";
import test from "node:test";
import { metaDescription } from "./seo.ts";

test("keeps a complete first sentence when it already fills the range", () => {
  const text =
    "Redline Labs lists laboratory research chemicals for purchase in Australia, with certificates of analysis available on request for the current catalogue.";
  assert.equal(metaDescription(text), text);
  assert.ok(metaDescription(text).length >= 140);
  assert.ok(metaDescription(text).length <= 160);
});

test("adds the next sentence when the first is too short", () => {
  const result = metaDescription(
    "Laboratory research chemicals shipped within Australia. For laboratory research use only, not for human or veterinary consumption.",
  );
  assert.match(result, /Australia/);
  assert.match(result, /research use only/);
});

test("truncates on a word boundary instead of mid-word", () => {
  const long =
    "This listing is a topical research formulation containing GHK copper tripeptide chelate, sodium hyaluronate, panthenol, and astaxanthin as labelled by the supplier.";
  const result = metaDescription(long);
  assert.ok(result.endsWith("…"));
  assert.ok(result.length <= 160);
  assert.equal(result.includes("supplier"), false);
});
