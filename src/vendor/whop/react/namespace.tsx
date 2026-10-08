"use client";
/* Vendored from https://github.com/whopio/elements v1.8.0 (MIT). See ../LICENSE or ./LICENSE. */
/**
 * `createNamespaceReact(namespace, childKeys)` — the generic, string-driven React glue
 * for one namespace. Returns a `HandleProvider`, a `useHandle` hook, and one component
 * per child element. ALL behavior lives here; the generated react `.d.ts` only adds types.
 *
 *   const ns = createNamespaceReact("checkout", ["email", "payment"]);
 *   export const Checkout = ns.HandleProvider;      // <Checkout planId="..."> — the emitter exports
 *   export const Payment = ns.components.payment;  // the provider BARE; ${Ns}Handle is the TYPE.
 *
 * Reveal model (per product decision): when a `fallback` is provided we keep the iframe
 * hidden (out of flow) and show the fallback until the element is FULLY loaded (`onReady`);
 * the iframe's own internal loading state is shown ONLY when no fallback is given.
 */

import type { WhopHandle } from './provider';

import {
  type ComponentType,
  createContext,
  createElement,
  type CSSProperties,
  forwardRef,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { pascal } from '../builder/naming';
import { useRootContext } from './provider';
import { useLiveHandle } from './util';

/** A mounted element handle (container/iframe + actions/host methods/update/destroy). */
type ElementHandle = Record<string, unknown> & {
  container: HTMLElement;
  destroy(): void;
  update(o: Record<string, unknown>): void;
};

export interface NamespaceReact {
  HandleProvider: ComponentType<Record<string, unknown>>;
  useHandle: () => WhopHandle | null;
  components: Record<string, ComponentType<Record<string, unknown>>>;
  /** one nested provider + element-component set per declared SUB-controller
   *  (SUB-CONTROLLERS.md) — `<Card>` inside `<Payments>`, `CardNumberElement` inside `<Card>`. */
  subs: Record<string, SubNamespaceReact>;
}

export interface SubNamespaceReact {
  Provider: ComponentType<Record<string, unknown>>;
  components: Record<string, ComponentType<Record<string, unknown>>>;
}

/** A child's React binding: its key + the `on<Event>` callback prop names it declares (its
 *  external events). The build derives `events` from the element def so the wired callback
 *  set is known up front — not inferred from first-render props. */
export interface ChildSpec {
  key: string;
  events?: string[];
}

/** A declared sub-controller's React binding: its key, ITS external events (delivered through
 *  the sub-handle's host-side callbacks), and its element children. */
export interface SubSpec {
  key: string;
  events?: string[];
  children: ChildSpec[];
}

/** The grouped-latch hiding treatment — the SAME treatment as `ctx.Loading`'s hidden mount
 *  (builder/loading-sentinel.ts HIDDEN_STYLE/REVEALED_STYLE/WRAPPER_LOADING_STYLE — mirrored
 *  here, not imported: this module is published npm surface and the vendor closure's
 *  deny-by-default VENDOR_SCOPE deliberately keeps builder modules out of it): out of flow so
 *  the fallback owns the footprint, full-width against the position:relative wrapper so field
 *  iframes and style probes initialize against the group's REAL slot (`display:none` collapses
 *  an iframe's viewport to 0×0 — everything inside measures zeros and the first resize reports
 *  are junk, so the reveal pops), invisible + non-interactive. `inert` rides a ref (React 18/19
 *  disagree on the prop; this layer runs on the consumer's React) — visibility:hidden iframes
 *  can still be focused programmatically, and display:none's free focus-immunity must not be
 *  lost. One deliberate delta from the sentinel constants: the wrapper CLIPS while loading —
 *  hidden out-of-flow boxes still contribute scrollable overflow, and on a CONSUMER page a
 *  hidden subtree taller than the fallback would inflate the host page's scroll height with
 *  empty space (clipping is paint-only — probes still measure real, unclipped rects). */
const GROUP_HIDDEN_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  visibility: 'hidden',
  pointerEvents: 'none',
};
const GROUP_REVEALED_STYLE: CSSProperties = { display: 'contents' };
const GROUP_WRAPPER_LOADING_STYLE: CSSProperties = { position: 'relative', overflow: 'hidden' };

function groupLatch(hidden: boolean, fallback: ReactNode, children: ReactNode): ReactNode {
  return createElement(
    'div',
    { style: hidden ? GROUP_WRAPPER_LOADING_STYLE : GROUP_REVEALED_STYLE },
    hidden ? fallback : null,
    createElement(
      'div',
      {
        style: hidden ? GROUP_HIDDEN_STYLE : GROUP_REVEALED_STYLE,
        'aria-hidden': hidden ? true : undefined,
        ref: (el: HTMLElement | null) => {
          if (!el) return;
          if (hidden) el.setAttribute('inert', '');
          else el.removeAttribute('inert');
        },
      },
      children,
    ),
  );
}

export function createNamespaceReact(
  namespace: string,
  children: ChildSpec[],
  handleEvents: string[] = [],
  subSpecs: SubSpec[] = [],
): NamespaceReact {
  const Ns = pascal(namespace);
  const WhopHandleContext = createContext<WhopHandle | null | undefined>(undefined);
  // handle-level consumer callbacks wired as STABLE wrappers at create: the controller's external
  // events (on<Event>) + the framework's `onLoadingChange`. Stable identity means inline closures (and
  // conditionally-added handlers) are delivered live without forcing a `handle.update()` every render.
  const handleCallbacks = [...new Set([...handleEvents, 'onLoadingChange'])];

  function useHandle(): WhopHandle | null {
    const nsHandle = useContext(WhopHandleContext);
    if (nsHandle === undefined) throw new Error(`${Ns} element components must be used within <${Ns}>`);
    return nsHandle;
  }

  const HandleProvider = forwardRef<{ handle: WhopHandle | null }, Record<string, unknown>>(
    function HandleProvider(props, ref) {
      const { children, fallback, ...options } = props as {
        children?: ReactNode;
        fallback?: ReactNode;
      } & Record<string, unknown>;
      const { root, config } = useRootContext();
      const merged = { ...(config as Record<string, unknown>), ...options };

      // created once when the root resolves; useLiveHandle owns the latest-ref, stable handle-callback
      // wrappers, and the shallowEqual-guarded DATA-only update() flow.
      const nsHandle = useLiveHandle<WhopHandle>(
        merged,
        handleCallbacks,
        root,
        (options, live) => (root ? root[namespace]!.create({ ...options, ...live }) : null),
        // an older hosted elements.js predates destroy() and carries only teardown().
        { destroy: (s) => (s.destroy ? s.destroy() : s.teardown?.()) },
      );
      useImperativeHandle(ref, () => ({ handle: nsHandle }), [nsHandle]);

      // children create their element handles during RENDER (useLiveHandle's ref-cached lazy
      // init), so by this effect every eager element is already in the latch. Nothing there →
      // no eager children exist: seal to loaded, or a fallback-driven handle whose elements
      // all mount conditionally would hide the very controls that mount them, forever.
      // Optional-chained: the hosted runtime may predate the seal (independent versioning).
      useEffect(() => {
        if (nsHandle) nsHandle.sealLoadingIfEmpty?.();
      }, [nsHandle]);

      // controller loading: grouped child readiness, latched once loaded. While loading we show
      // `fallback` but KEEP the children mounted (hidden-but-laid-out) so their iframes actually
      // load — a visibility:hidden subtree still loads, so hiding them can't deadlock the loading.
      const subscribe = useCallback(
        (cb: () => void) => (nsHandle ? nsHandle.subscribeLoading(cb) : () => {}),
        [nsHandle],
      );
      const getLoading = useCallback(() => (nsHandle ? nsHandle.isLoading() : true), [nsHandle]);
      const loading = useSyncExternalStore(subscribe, getLoading, () => true);

      // Only swap to the controller fallback when one is provided; without one the children render
      // normally and each element shows its own loading UI. The wrapper + container pair is
      // UNCONDITIONAL and keeps its identity across the flip (both `display:contents` when
      // revealed), so the children reconcile in place — a structure change on reveal (or on a
      // fallback prop appearing later) would remount them and reload every field iframe.
      const hideChildren = loading && fallback != null;
      return createElement(
        WhopHandleContext.Provider,
        { value: nsHandle },
        groupLatch(hideChildren, fallback, children),
      );
    },
  );
  HandleProvider.displayName = Ns;

  const components: Record<string, ComponentType<Record<string, unknown>>> = {};
  for (const child of children)
    components[child.key] = makeElementComponent(namespace, child.key, useHandle, child.events ?? []);

  const subs: Record<string, SubNamespaceReact> = {};
  for (const sub of subSpecs) subs[sub.key] = makeSubNamespace(namespace, sub, useHandle);

  return { HandleProvider, useHandle, components, subs };
}

/** The minted sub handle (`handle.create(subKey, …)` — SUB-CONTROLLERS.md, explicit lifecycle):
 *  element factory + consumer-props/callback sink + teardown. Actions ride it too, but this
 *  layer only needs these three. */
type SubHandle = Record<string, unknown> & {
  create(child: string, options: Record<string, unknown>): ElementHandle;
  update(options: Record<string, unknown>): void;
  destroy(): void;
};

/**
 * The nested provider + element components for one declared sub-controller: `<Card brandHint=…
 * onChanged={…}>` forwards its data props + external-event callbacks to the sub-handle (live,
 * through the same latest-ref rail as everything else), and its element children mount through
 * the sub-handle's `createElement` — dot-composed wire identity, parent channel, one coordinator.
 * The provider does NOT gate rendering (the sub is not a mount — its elements each own their
 * readiness; grouped loading stays the PARENT provider's fallback, which already covers them).
 */
function makeSubNamespace(
  namespace: string,
  sub: SubSpec,
  useParentHandle: () => WhopHandle | null,
): SubNamespaceReact {
  const SubContext = createContext<SubHandle | null | undefined>(undefined);
  const label = `${pascal(namespace)}.${pascal(sub.key)}`;
  const subCallbacks = [...new Set(sub.events ?? [])];

  function useSubHandle(): SubHandle | null {
    const subHandle = useContext(SubContext);
    if (subHandle === undefined)
      throw new Error(`${label} element components must be used within <${pascal(sub.key)}>`);
    return subHandle;
  }

  const Provider = forwardRef<{ handle: SubHandle | null }, Record<string, unknown>>(function SubProvider(props, ref) {
    const { children, ...rest } = props as { children?: ReactNode } & Record<string, unknown>;
    const parent = useParentHandle();
    // EXPLICIT lifecycle, exactly the vanilla surface's semantics (SUB-CONTROLLERS.md):
    // provider mount = `parent.create(subKey, jsxProps)` (claims the exclusive slot, lazily
    // boots the sub runtime), unmount = `destroy()` (frees it); data-prop changes ride the
    // shallowEqual-guarded update, callbacks stay live through the stable wrappers.
    const subHandle = useLiveHandle<SubHandle>(
      rest,
      subCallbacks,
      parent,
      (options, live) => {
        if (!parent || typeof parent.create !== 'function') return null;
        return (parent.create as (key: string, options: Record<string, unknown>) => SubHandle)(sub.key, {
          ...options,
          ...live,
        });
      },
      { destroy: (s) => s.destroy() },
    );
    // the minted sub handle, reachable from React (1:1 vanilla parity: actions/update live
    // on it) — the same `{ handle }` ref shape HandleProvider exposes.
    useImperativeHandle(ref, () => ({ handle: subHandle }), [subHandle]);
    return createElement(SubContext.Provider, { value: subHandle }, children);
  }) as unknown as ComponentType<Record<string, unknown>>;
  (Provider as { displayName?: string }).displayName = label;

  const components: Record<string, ComponentType<Record<string, unknown>>> = {};
  for (const child of sub.children) {
    components[child.key] = makeElementComponent(
      `${namespace}.${sub.key}`,
      child.key,
      useSubHandle as () => WhopHandle | null,
      child.events ?? [],
    );
  }
  return { Provider, components };
}

function makeElementComponent(
  namespace: string,
  key: string,
  useHandle: () => WhopHandle | null,
  eventCallbacks: string[],
): ComponentType<Record<string, unknown>> {
  // the element's DECLARED event callbacks + the pure-passthrough framework lifecycle callback —
  // one generic stable-wrapper rail for everything that doesn't drive local component state.
  const wiredCallbacks = [...new Set([...eventCallbacks, 'onLoaderStart'])];
  const ElementComponent = forwardRef<unknown, Record<string, unknown>>(function ElementComponent(props, ref) {
    const { className, style, fallback, ...rest } = props as {
      className?: string;
      style?: CSSProperties;
      fallback?: ReactNode;
    } & Record<string, unknown>;

    const nsHandle = useHandle();
    const containerRef = useRef<HTMLDivElement>(null);
    // ready belongs to ONE handle: a replaced handle (handle change, or replace-if-dead in
    // useLiveHandle) starts unready, so a `fallback` covers the new frame until it boots.
    const [readyHandle, setReadyHandle] = useState<ElementHandle | null>(null);

    // created once per handle; useLiveHandle owns the latest-ref, stable wrappers for the
    // wired callbacks (known up front, so a callback added on a later render is still
    // delivered), and the shallowEqual-guarded DATA-only update() flow.
    // onReady/onError are the ONLY hand-wired callbacks — they also drive the ready state.
    // mount the handle's container into our div; destroy on unmount / handle change. destroy() owns
    // the full teardown (iframe + the SDK-created container it appended), so an in-place handle
    // change (new handle) can't orphan the old empty container div in the DOM.
    const handle = useLiveHandle<ElementHandle>(
      rest,
      wiredCallbacks,
      nsHandle,
      (options, live, latest) => {
        if (!nsHandle || typeof nsHandle.create !== 'function') return null;
        const minted: ElementHandle = (
          nsHandle.create as (key: string, options: Record<string, unknown>) => ElementHandle
        )(key, {
          ...options,
          ...live,
          onReady: () => {
            setReadyHandle(minted);
            (latest.current.onReady as (() => void) | undefined)?.();
          },
          // an error settles the ready state too: the frame is showing its `.error()` face,
          // and a `fallback` that keeps hiding the iframe would bury it forever (a retried
          // boot's later `ready` keeps it settled).
          onError: (e: { message: string; code?: string }) => {
            setReadyHandle(minted);
            (latest.current.onError as ((e: { message: string; code?: string }) => void) | undefined)?.(e);
          },
        });
        return minted;
      },
      {
        attach: (mounted) => containerRef.current?.appendChild(mounted.container),
        destroy: (mounted) => mounted.destroy(),
      },
      true,
    );
    const ready = handle !== null && readyHandle === handle;

    useImperativeHandle(ref, () => handle, [handle]);

    // fallback present + not ready → hide the iframe out of flow, show the fallback.
    const showFallback = fallback != null && !ready;
    const containerStyle: CSSProperties = showFallback
      ? { ...style, position: 'absolute', visibility: 'hidden', pointerEvents: 'none', width: '100%' }
      : (style ?? {});

    return createElement(
      Fragment,
      null,
      createElement('div', { ref: containerRef, className, style: containerStyle }),
      showFallback ? fallback : null,
    );
  });
  // per-SEGMENT pascal: a sub element's namespace is dot-composed ("wallet.cardFields") and a
  // whole-string pascal would emit "Wallet.cardFields.Number" in devtools.
  ElementComponent.displayName = `${namespace.split('.').map(pascal).join('.')}.${pascal(key)}`;
  return ElementComponent;
}
