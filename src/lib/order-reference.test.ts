import assert from "node:assert/strict";
import test from "node:test";
import {
  generateOrderReference,
  isOrderReference,
  normalizeOrderReference,
} from "./order-reference.ts";

test("references avoid characters that are misread when retyped", () => {
  for (let run = 0; run < 500; run += 1) {
    const reference = generateOrderReference();
    assert.match(reference, /^RL-[A-Z2-9]{6}$/);
    assert.equal(/[O0I1]/.test(reference.slice(3)), false);
  }
});

test("every byte value maps to a character so the alphabet is unbiased", () => {
  const seen = new Set<string>();
  for (let byte = 0; byte < 256; byte += 1) {
    seen.add(generateOrderReference(new Uint8Array(6).fill(byte)).slice(3, 4));
  }
  assert.equal(seen.size, 32);
});

test("generate rejects too little entropy instead of padding it", () => {
  assert.throws(() => generateOrderReference(new Uint8Array(5)), /six random bytes/);
});

test("only well formed references are accepted as keys", () => {
  assert.equal(isOrderReference("RL-7F3K2Q"), true);
  assert.equal(isOrderReference("RL-7F3K2"), false);
  assert.equal(isOrderReference("RL-7F3K2QQ"), false);
  assert.equal(isOrderReference("XX-7F3K2Q"), false);
  assert.equal(isOrderReference("RL-7F3K2O"), false);
  assert.equal(isOrderReference("RL-7f3k2q"), false);
  assert.equal(isOrderReference(null), false);
});

test("normalize uppercases a typed reference and rejects anything else", () => {
  assert.equal(normalizeOrderReference(" rl-7f3k2q "), "RL-7F3K2Q");
  assert.equal(normalizeOrderReference("RL-7F3K2Q"), "RL-7F3K2Q");
  assert.equal(normalizeOrderReference("'; DROP TABLE orders; --"), null);
  assert.equal(normalizeOrderReference(""), null);
});
