"use client";
/* Vendored from https://github.com/whopio/elements v1.8.0 (MIT). See ../LICENSE or ./LICENSE. */
/**
 * `<WhopElements>` — the root of the React wrapper. It resolves the loaded
 * `WhopConstructor` (a function, or a promise of one, from the vanilla loader's
 * `loadWhop()`), invokes it with the global config, and puts the resulting `Whop` instance
 * + the live global config into context. Namespace handle providers read both from here.
 *
 * UI-free + element-UI-free: this only drives the imperative SDK. The types the consumer
 * sees come from the GENERATED react `.d.ts`; here everything is structurally typed.
 */

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

/** Global config drilled into every handle (live: appearance/locale propagate via update). */
export interface GlobalConfig {
  appearance?: unknown;
  locale?: string;
  /** Which Whop API environment the elements talk to — forwarded to the constructor (the
   *  published WhopElementsProps types it; dropping it here silently pinned production). */
  environment?: string;
  /** Whether elements may show toast notifications — forwarded to the constructor (the toast
   *  host registers there, first-root-wins; the same drop-here-and-it-silently-defaults class
   *  as `environment`). */
  toasts?: boolean;
  /** Override the origin serving the hosted element pages (local/staging). */
  baseUrl?: string;
  /** Skip linking element analytics to the Whop pixel's visitor id on pages that run the
   *  pixel — forwarded to the constructor. Usage analytics themselves are unaffected.
   *  Load-time, like environment/baseUrl. @default false */
  skipPixel?: boolean;
}

/** A handle instance — the imperative surface installed by the host runtime. */
export type WhopHandle = Record<string, unknown> & {
  createElement(
    name: string,
    options?: Record<string, unknown>,
  ): { container: HTMLElement; destroy(): void; update(o: Record<string, unknown>): void } & Record<string, unknown>;
  update(options: Record<string, unknown>): void;
  /** controller loading state (grouped child readiness) — for the provider's fallback. */
  isLoading(): boolean;
  subscribeLoading(cb: () => void): () => void;
  /** seal the grouped loading when no element mounted eagerly. Optional: the react glue and
   *  the hosted runtime version independently, and an older elements.js predates the seal. */
  sealLoadingIfEmpty?(): void;
  /** the consumer teardown verb. Optional for the same versioning reason — an older
   *  elements.js predates it and carries only `teardown`; the unmount path falls back. */
  destroy?(): void;
  teardown?(): void;
};
/** A namespace on the resolved instance: `create(opts)` boots a handle, plus each of the
 *  controller's STATIC actions (`WhopElements.<ns>.<action>`) dispatched with nothing mounted. The
 *  generated react `.d.ts` types the exact static-action set; here it's structural. */
type WhopNamespace = { create: (options?: Record<string, unknown>) => WhopHandle } & Record<
  string,
  (input?: unknown) => Promise<unknown>
>;
export type Whop = Record<string, WhopNamespace>;
export type WhopConstructor = (config?: Record<string, unknown>) => Whop;

/** What the consumer passes to `elements`: the factory, or a promise resolving to it.
 *  The vendored loader's promise resolves to the hosted SDK (`unknown` until the
 *  script assigns `window.WhopElements`), so a pending load is accepted too. */
export type ElementsProp = WhopConstructor | PromiseLike<WhopConstructor | null> | PromiseLike<unknown> | null;

interface RootContextValue {
  root: Whop | null;
  config: GlobalConfig;
}

const RootContext = createContext<RootContextValue | null>(null);

/** Internal: the full context (root + live global config) — the per-namespace handle providers need
 *  both. Throws if used outside <WhopElements>. Not re-exported to consumers. */
export function useRootContext(): RootContextValue {
  const ctx = useContext(RootContext);
  if (!ctx) throw new Error('Whop Elements components must be used within <WhopElements>');
  return ctx;
}

/** The resolved Whop instance, or `null` while the loader promise is still pending. Throws if
 *  used outside <WhopElements>. */
export function useWhop(): Whop | null {
  return useRootContext().root;
}

/** What useSyncExternalStore tracks: the resolved constructor, or a captured load error. */
interface LoaderState {
  ctor: WhopConstructor | null;
  error: Error | null;
}
/** Stable "pending" snapshot — a module constant so the SSR/initial snapshot is referentially stable. */
const PENDING: LoaderState = { ctor: null, error: null };

/** A `useSyncExternalStore`-compatible holder for a (maybe-pending) constructor promise. Resolves to
 *  the constructor, or captures a load FAILURE so the provider can surface it (instead of hanging). */
class LoaderStore {
  private subscribers = new Set<() => void>();
  private state: LoaderState = PENDING;

  constructor(prop: ElementsProp) {
    // explicit `null` is a legal deferred-init value — stay pending, mount nothing.
    if (prop === null) return;
    Promise.resolve(prop)
      .then((value) => {
        if (typeof value === "function") {
          this.set({ ctor: value as WhopConstructor, error: null });
          return;
        }
        if (value == null) {
          this.set({ ctor: null, error: null });
          return;
        }
        this.set({ ctor: null, error: new Error("Whop Elements did not initialize") });
      })
      .catch((e) =>
        this.set({ ctor: null, error: e instanceof Error ? e : new Error("Failed to load Whop Elements") }),
      );
  }

  private set(state: LoaderState): void {
    this.state = state;
    for (const s of this.subscribers) s();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  };

  getSnapshot = (): LoaderState => this.state;
}

export function WhopElements({
  children,
  elements,
  appearance,
  locale,
  environment,
  toasts,
  baseUrl,
  skipPixel,
  onLoadError,
}: {
  children: ReactNode;
  elements: ElementsProp;
  /** Reported instead of thrown when the SDK fails to load: the tree stays mounted in the deferred
   *  state (as with `elements={null}`). `retry()` starts a fresh load in place — the parent keeps
   *  passing the same `elements`. */
  onLoadError?: (error: Error, retry: () => void) => void;
} & GlobalConfig): ReactNode {
  // a retry swaps the load INSIDE the provider (the parent never re-renders or holds state); a new
  // `elements` from the parent supersedes it.
  const [retried, setRetried] = useState<{ of: ElementsProp; load: ElementsProp } | null>(null);
  const current = retried && retried.of === elements ? retried.load : elements;
  // new store per load identity; resolves the (possibly async) constructor or its failure.
  const store = useMemo(() => new LoaderStore(current), [current]);
  const { ctor, error } = useSyncExternalStore(store.subscribe, store.getSnapshot, () => PENDING);

  // the root carries environment/baseUrl (load-time origin selection — "cannot change after
  // load"), toasts (the toast host registers at construction, first-root-wins — a later
  // flip cannot take effect by design), and skipPixel (the wuid link runs once at load), so
  // it's recreated only when those change; appearance/locale are live and reach handles via
  // the config below (create + update), not a new root.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const root = useMemo(
    () => (ctor ? ctor({ appearance, locale, environment, toasts, baseUrl, skipPixel }) : null),
    [ctor, environment, toasts, baseUrl, skipPixel],
  );

  const config = useMemo<GlobalConfig>(
    () => ({ appearance, locale, environment, toasts, baseUrl }),
    [appearance, locale, environment, toasts, baseUrl],
  );
  const value = useMemo<RootContextValue>(() => ({ root, config }), [root, config]);

  // any retry handed out acts on whatever is failed NOW (a held one from an earlier failure included)
  // and does nothing while a load is in flight or has succeeded — a redundant retry must not swap
  // the store, which would remount every element. The ref moves in the COMMIT phase: a render that
  // never commits (a suspended transition to a new load) must not redirect the retry button the
  // user can still see. Declared before the report effect so a fresh failure reads committed state.
  const latest = useRef({ elements, current, store });
  useEffect(() => {
    latest.current = { elements, current, store };
  });
  const retry = () => {
    const { elements: of, current: load, store: s } = latest.current;
    if (!s.getSnapshot().error) return;
    const own = (load as unknown as { retry?: unknown } | null)?.retry;
    if (typeof own !== 'function') {
      console.warn('whop elements: retry() needs the promise loadWhop() returns as `elements` — nothing to retry.');
      return;
    }
    setRetried({ of, load: (own as () => ElementsProp).call(load) });
  };

  // keyed on the error alone: it fires once per failed load, through the callback of the render
  // that committed the failure, and an inline arrow changing identity does not re-fire it.
  useEffect(() => {
    if (error) onLoadError?.(error, retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // guards AFTER the hooks (so hook order is stable): a MISSING `elements` prop is a mistake (forgot
  // the loader) → throw; explicit `null` stays deferred (pending). A failed load surfaces to the
  // nearest error boundary instead of hanging forever in "loading" — unless the consumer opted into
  // `onLoadError`, in which case the tree stays mounted, deferred, until `retry()` or a new `elements`.
  if (elements === undefined)
    throw new Error(
      '<WhopElements> requires an `elements` prop — pass loadWhop() (or its resolved value); use `null` to defer.',
    );
  if (error && !onLoadError) throw error;

  return createElement(RootContext.Provider, { value }, children);
}
