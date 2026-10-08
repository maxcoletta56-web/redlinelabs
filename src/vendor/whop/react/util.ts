"use client";
/* Vendored from https://github.com/whopio/elements v1.8.0 (MIT). See ../LICENSE or ./LICENSE. */
/**
 * Tiny helpers for the React wrapper runtime. React (external) plus same-package leaf
 * modules only — no internal WORKSPACE dep — so the whole `@local/elements-framework/react`
 * subtree bundles cleanly into the published react-js package.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { EVENT_HANDLERS_PROP, HANDLER_PRESENT } from '../builder/event-handlers';
import { isCallbackName } from '../builder/naming';
import { shallowEqual } from '../builder/shallow-equal';

/**
 * The DATA slice of a props bag: every `on[A-Z]` key is stripped REGARDLESS of value — callbacks
 * never ride `update()`; they are delivered through the stable live wrappers reading `latest`.
 * The value check matters: `onX={undefined}` (a conditionally-absent JSX callback) riding as
 * DATA would clobber the stable wrapper in the SDK's options bag permanently — events silently
 * stop even after the consumer passes a real callback again (the wrappers install only at
 * create). The builder bans authored `on[A-Z]` data props, so nothing legitimate is lost.
 */
function dataOptions(props: Record<string, unknown>, callbackKeys?: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (isCallbackName(k)) continue;
    out[k] = v;
  }
  if (callbackKeys)
    out[EVENT_HANDLERS_PROP] = callbackKeys
      .filter((key) => typeof props[key] === 'function')
      .sort()
      .join(',');
  return out;
}

/**
 * Stable wrapper callbacks that always read the LATEST consumer callback from a ref.
 * Created once (at element create); their identity never changes across re-renders,
 * so the underlying SDK keeps a single stable `onX` while the consumer is free to
 * pass inline closures.
 */
function liveCallbacks(
  keys: string[],
  latest: { current: Record<string, unknown> },
): Record<string, (...args: unknown[]) => void> {
  const out: Record<string, (...args: unknown[]) => void> = {};
  for (const k of keys) {
    out[k] = (...args: unknown[]) => {
      const fn = latest.current[k];
      if (typeof fn === 'function') (fn as (...a: unknown[]) => void)(...args);
    };
    Object.defineProperty(out[k], HANDLER_PRESENT, { get: () => typeof latest.current[k] === 'function' });
  }
  return out;
}

/**
 * The shared live-handle lifecycle used by both the handle provider and the element
 * components: a `latest` props ref (read by the stable callback wrappers so inline
 * closures stay live without re-creating), a create-once memo keyed on `dep`, and a
 * shallowEqual-guarded effect that pushes DATA-only updates (callbacks excluded — they
 * never force an update). `create` receives the current data options, the stable
 * wrappers for `callbackKeys`, and the `latest` ref (for wiring extra callbacks like
 * onReady/onError). An optional `lifecycle` tears the handle down on unmount / handle change
 * and replaces it when an effect comes back to one it already destroyed (see below).
 */
export function useLiveHandle<T extends { update(options: Record<string, unknown>): void }>(
  props: Record<string, unknown>,
  callbackKeys: string[],
  dep: unknown,
  create: (
    options: Record<string, unknown>,
    live: Record<string, (...args: unknown[]) => void>,
    latest: { current: Record<string, unknown> },
  ) => T | null,
  lifecycle?: HandleLifecycle<T>,
  trackEventHandlers = false,
): T | null {
  const latest = useRef<Record<string, unknown>>(props);
  latest.current = props;

  // created once per `dep`; data changes flow through the guarded update below, callbacks
  // stay live via the stable wrappers (which read `latest`), so they never force update().
  // Ref-cached lazy init instead of useMemo: StrictMode double-invokes useMemo calculations,
  // which would create (and leak) a second live element — and trip the one-consumer-instance
  // guard. The ref guard runs `create` exactly once per `dep` and `generation`.
  const [generation, setGeneration] = useState(0);
  const cache = useRef<{ dep: unknown; generation: number; handle: T | null } | null>(null);
  if (cache.current === null || cache.current.dep !== dep || cache.current.generation !== generation) {
    cache.current = {
      dep,
      generation,
      handle: create(
        dataOptions(latest.current, trackEventHandlers ? callbackKeys : undefined),
        liveCallbacks(callbackKeys, latest),
        latest,
      ),
    };
  }
  const handle = cache.current.handle;
  const destroyed = useRef<T | null>(null);

  const prev = useRef<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!handle || handle === destroyed.current) return;
    const options = dataOptions(latest.current, trackEventHandlers ? callbackKeys : undefined);
    if (prev.current && shallowEqual(prev.current, options)) return;
    prev.current = options;
    handle.update(options);
  });

  // REPLACE-IF-DEAD. The handle is minted in render, but its teardown runs in an effect cleanup,
  // and React can run that cleanup and then the effect again on the SAME fiber: StrictMode's dev
  // reconnect of a fresh mount, a shown `<Activity>`, Fast Refresh. The cleanup still destroys at
  // once; when the effect comes back to a handle this hook destroyed, it bumps `generation`, and
  // the next render mints a fresh one through the same ref-cached init. A provider's new handle
  // reaches its children through context, so their elements take the ordinary handle-change path.
  // The check is a LAYOUT effect even where the destroy is passive: layout effects reappear before
  // passive ones, so an element and its provider both renew in one batched render (the provider
  // renders first) instead of the element minting on a dead provider handle in between.
  useLayoutEffect(() => {
    if (!handle || !lifecycle) return;
    if (handle === destroyed.current) {
      setGeneration((n) => n + 1);
      return;
    }
    if (!lifecycle.attach) return;
    lifecycle.attach(handle);
    return () => {
      destroyed.current = handle;
      lifecycle.destroy(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);
  useEffect(() => {
    if (!handle || !lifecycle || lifecycle.attach || handle === destroyed.current) return;
    return () => {
      destroyed.current = handle;
      lifecycle.destroy(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  return handle;
}

/**
 * How `useLiveHandle` tears its handle down. `destroy` runs synchronously in the effect cleanup:
 * a PASSIVE cleanup by default (providers), or the LAYOUT cleanup when `attach` is given (an
 * element appends its container in the layout effect and removes it in the same cleanup, so on a
 * real unmount every element is destroyed before its provider).
 */
export type HandleLifecycle<T> = {
  destroy: (handle: T) => void;
  attach?: (handle: T) => void;
};
