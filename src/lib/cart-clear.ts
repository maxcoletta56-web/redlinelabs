export const CART_CLEARED_PREFIX = "redline-cart-cleared:";

export function cartClearedStorageKey(onceKey: string) {
  return `${CART_CLEARED_PREFIX}${onceKey}`;
}

/**
 * The Payoneer success page has no stable key, so every visit clears the cart.
 * The bank-transfer order page is bookmarked to check status, so it clears
 * only the first time that reference is opened in this browser.
 */
export function shouldClearCart(onceKey: string | undefined, alreadyCleared: boolean) {
  if (!onceKey) return true;
  return !alreadyCleared;
}
