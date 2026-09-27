import { randomBytes } from "node:crypto";

export const ORDER_REFERENCE_PREFIX = "RL";

/**
 * 32 characters, so one random byte maps to one character without modulo bias.
 * O, 0, I, and 1 are left out because references are read off a phone screen
 * and retyped into a bank transfer description.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const BODY_LENGTH = 6;

export const ORDER_REFERENCE_PATTERN = new RegExp(
  `^${ORDER_REFERENCE_PREFIX}-[${ALPHABET}]{${BODY_LENGTH}}$`,
);

export function isOrderReference(value: string | null | undefined): boolean {
  return typeof value === "string" && ORDER_REFERENCE_PATTERN.test(value);
}

/** Uppercases and normalises a reference typed by a customer or pasted into a URL. */
export function normalizeOrderReference(value: string | null | undefined): string | null {
  const candidate = value?.trim().toUpperCase() ?? "";
  return isOrderReference(candidate) ? candidate : null;
}

export function generateOrderReference(bytes: Uint8Array = randomBytes(BODY_LENGTH)): string {
  if (bytes.length < BODY_LENGTH) {
    throw new Error("Order reference needs at least six random bytes");
  }
  let body = "";
  for (let index = 0; index < BODY_LENGTH; index += 1) {
    body += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return `${ORDER_REFERENCE_PREFIX}-${body}`;
}
