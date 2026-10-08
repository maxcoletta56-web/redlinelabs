/* Vendored from https://github.com/whopio/elements v1.8.0 (MIT). See ../LICENSE or ./LICENSE. */
/**
 * The one `shallowEqual` — own enumerable keys, values compared by `Object.is`, with an identity
 * fast path. React-free and dependency-free (a LEAF): imported by both the direct controller
 * runtime (referential-stability of injected props) and the react wrapper (guarding DATA-only
 * update()), so the two can't drift on equality semantics. `Object.is` (not `!==`) matters — a
 * NaN-valued prop must compare equal to itself, else the injected cache mints a fresh object every
 * recompute and the element re-renders on every controller render.
 */
export function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a === b) return true;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (!Object.is(a[k], b[k])) return false;
  return true;
}
