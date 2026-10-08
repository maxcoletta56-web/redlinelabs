/* Vendored from https://github.com/whopio/elements v1.8.0 (MIT). See ../LICENSE or ./LICENSE. */
/**
 * The runtime's published-surface name mangles — the ONE framework home every runtime site
 * imports (consumer-handler dispatch, testing spies, demo-harness auto-log, react displayName).
 * Codegen's naming.ts carries the emitter copy (dependency direction forbids importing it here);
 * a codegen test pins the two, so the emitted `on<Event>` / `<Pascal>` names can never drift from
 * what the runtime dispatches — drift would make consumer callbacks silently never fire.
 */

/** child key / namespace → its published PascalCase identifier: "pay-button" → "PayButton". */
export const pascal = (s: string): string => s.replace(/(^|-)([a-z])/g, (_m, _sep, c: string) => c.toUpperCase());

/** event name → its consumer callback name: "paid" → "onPaid". First char only — never folds
 *  separators. */
export const onName = (event: string): string => `on${event[0]!.toUpperCase()}${event.slice(1)}`;

/** Whether a key sits in the consumer-callback namespace (`onReady`, `onPaymentMethodChosen`, …) —
 *  the ONE predicate for the `on[A-Z]…` space every surface reserves (create-option split, reserved-
 *  name bans, prop-layer strips, the react wrapper's callback partition). */
export const isCallbackName = (k: string): boolean => /^on[A-Z]/.test(k);
