/* Vendored from https://github.com/whopio/elements v1.8.0 (MIT). See ./LICENSE. */
/**
 * The published vanilla package's runtime: a tiny loader that pulls the (versioned) hosted SDK onto
 * the consumer page. This file is REAL source — typechecked here, then esbuild-bundled per format
 * (esm → index.js, cjs → index.cjs) with ORIGIN/SDK_URL define-injected at build time (same
 * technique as the boot shim). Never imported at runtime by this package.
 *
 * Classic <script> injection rather than a dynamic import() of an external URL — the pattern
 * hosted-SDK loaders converge on: bundler-agnostic (nothing for webpack/Vite to rewrite), works
 * without a bundler, and elements.js self-locates via document.currentScript. One promise per tag,
 * handed back by every call — loading, loaded, or failed — until the promise's own retry() asks for
 * a fresh one. NOTE: this file ships as readable source in the public mirror — its comments are
 * consumer-facing.
 */

const ORIGIN = 'https://cdn.whop.com';
const SDK_URL = 'https://cdn.whop.com/elements/amber/elements.js';

// the app's built locale set (default locale first), define-injected from the ratified config —
// the runtime value behind the generated `WhopElementsLocale` union, for validating dynamic strings.
const WHOP_ELEMENTS_LOCALES = ['en', 'es', 'zh', 'nl', 'pt', 'de', 'hu', 'it', 'fr', 'ja', 'pl', 'tr'];

// The Whop API origin for each `environment`, and the third-party origins the work elements do on
// the embedding page reaches, grouped (the Apple Pay, Google Pay, and PayPal sheets, for example)
// and resolved per environment.
const API_ORIGINS = { production: 'https://api.whop.com', sandbox: 'https://sandbox-api.whop.com' };
const PAGE_REQUIREMENTS = {
  wallets: {
    production: {
      sources: {
        'frame-src': ['https://checkout.paypal.com', 'https://assets.braintreegateway.com', 'https://www.paypal.com'],
        'script-src': [
          'https://pay.google.com',
          'https://applepay.cdn-apple.com',
          'https://js.braintreegateway.com',
          'https://www.paypal.com',
          'https://c.paypal.com',
        ],
        'connect-src': [
          'https://pay.google.com',
          'https://google.com',
          'https://account.google.com',
          'https://www.google.com',
          'https://api.basistheory.com',
          'https://payments.braintree-api.com',
          'https://api.braintreegateway.com',
          'https://api-m.paypal.com',
          'https://www.paypal.com',
        ],
        'img-src': ['https://www.paypalobjects.com'],
      },
      hints: [
        { rel: 'preload', href: 'https://pay.google.com/gp/p/js/pay.js', as: 'script' },
        {
          rel: 'preload',
          href: 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js',
          as: 'script',
          crossOrigin: 'anonymous',
        },
        {
          rel: 'preload',
          href: 'https://js.braintreegateway.com/web/3.146.0/js/paypal-checkout-v6.min.js',
          as: 'script',
        },
        { rel: 'preload', href: 'https://www.paypal.com/web-sdk/v6/core', as: 'script' },
        { rel: 'preconnect', href: 'https://api.basistheory.com', crossOrigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://payments.braintree-api.com', crossOrigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://api.braintreegateway.com', crossOrigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://checkout.paypal.com' },
        { rel: 'preconnect', href: 'https://assets.braintreegateway.com' },
        { rel: 'preconnect', href: 'https://c.paypal.com' },
        { rel: 'preconnect', href: 'https://api-m.paypal.com', crossOrigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://www.paypal.com', crossOrigin: 'anonymous' },
      ],
    },
    sandbox: {
      sources: {
        'frame-src': [
          'https://checkout.paypal.com',
          'https://assets.braintreegateway.com',
          'https://www.sandbox.paypal.com',
        ],
        'script-src': [
          'https://pay.google.com',
          'https://applepay.cdn-apple.com',
          'https://js.braintreegateway.com',
          'https://www.sandbox.paypal.com',
          'https://c.paypal.com',
        ],
        'connect-src': [
          'https://pay.google.com',
          'https://google.com',
          'https://account.google.com',
          'https://www.google.com',
          'https://api.basistheory.com',
          'https://payments.sandbox.braintree-api.com',
          'https://api.sandbox.braintreegateway.com',
          'https://api-m.sandbox.paypal.com',
          'https://www.sandbox.paypal.com',
        ],
        'img-src': ['https://www.paypalobjects.com'],
      },
      hints: [
        { rel: 'preload', href: 'https://pay.google.com/gp/p/js/pay.js', as: 'script' },
        {
          rel: 'preload',
          href: 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js',
          as: 'script',
          crossOrigin: 'anonymous',
        },
        {
          rel: 'preload',
          href: 'https://js.braintreegateway.com/web/3.146.0/js/paypal-checkout-v6.min.js',
          as: 'script',
        },
        { rel: 'preload', href: 'https://www.sandbox.paypal.com/web-sdk/v6/core', as: 'script' },
        { rel: 'preconnect', href: 'https://api.basistheory.com', crossOrigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://payments.sandbox.braintree-api.com', crossOrigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://api.sandbox.braintreegateway.com', crossOrigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://checkout.paypal.com' },
        { rel: 'preconnect', href: 'https://assets.braintreegateway.com' },
        { rel: 'preconnect', href: 'https://c.paypal.com' },
        { rel: 'preconnect', href: 'https://api-m.sandbox.paypal.com', crossOrigin: 'anonymous' },
        { rel: 'preconnect', href: 'https://www.sandbox.paypal.com', crossOrigin: 'anonymous' },
      ],
    },
  },
};

const TAG = 'script[data-whop-elements]';

type WhopWindow = Window & { WhopElements?: unknown };
/** The promise loadWhop() returns: the load itself, plus retry() for a fresh load after a failure. */
type WhopLoad = Promise<unknown> & { retry(): WhopLoad };
type WhopScript = HTMLScriptElement & { __whopReady?: WhopLoad; __whopFailed?: true };

// The SDK present with no tag to hang the promise on (loaded some other way): one promise, so a
// page that calls loadWhop() on every render keeps seeing the same object.
let resolved: WhopLoad | null = null;

function withRetry(promise: Promise<unknown>): WhopLoad {
  return Object.assign(promise, { retry: retryWhop });
}

function loadWhop(): WhopLoad {
  if (typeof window === 'undefined')
    return withRetry(Promise.reject(new Error('WhopElements requires a browser environment')));
  const w = window as WhopWindow;
  const existing = document.querySelector<HTMLScriptElement>(TAG) as WhopScript | null;
  // the tag's promise, whatever state it is in: the same object on every call, so nothing that
  // keys on identity (the react provider does) sees a change until retry() makes one.
  if (existing?.__whopReady) return cached(existing);
  if (w.WhopElements) return (resolved ??= withRetry(Promise.resolve(w.WhopElements)));
  return watch(w, existing ?? inject(), !existing);
}

// An older copy of this loader on the same page caches a plain promise on the tag, without
// retry() and without marking the tag on failure. Give it both in place, so the object every
// caller already holds keeps its identity and a retry through this copy still works. Its state is
// unknown until it settles, so a retry asked before then waits for the verdict: a resolution is
// the load, a rejection marks the tag dead and replaces it.
function cached(script: WhopScript): WhopLoad {
  const ready = script.__whopReady as WhopLoad;
  if (typeof ready.retry !== 'function') {
    let settled = false;
    ready.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
        script.__whopFailed = true;
      },
    );
    Object.assign(ready, {
      retry: (): WhopLoad =>
        settled
          ? retryWhop()
          : withRetry(
              ready.then(
                (value) => value,
                () => retryWhop(),
              ),
            ),
    });
  }
  return ready;
}

// A fresh attempt after a failure: the dead tag — the browser never retries a <script> whose load
// failed — is replaced in place by a new one carrying its src, nonce, crossorigin, integrity and
// referrer policy. While a load is in flight or has succeeded, this is just loadWhop().
function retryWhop(): WhopLoad {
  if (typeof window === 'undefined') return loadWhop();
  const dead = document.querySelector<HTMLScriptElement>(TAG) as WhopScript | null;
  if (!dead?.__whopFailed) return loadWhop();
  return watch(window as WhopWindow, inject(dead), true);
}

function inject(replacing?: WhopScript): WhopScript {
  const s = document.createElement('script') as WhopScript;
  s.src = replacing?.src || SDK_URL;
  s.async = true;
  s.setAttribute('data-whop-elements', '');
  if (replacing) {
    if (replacing.nonce) s.nonce = replacing.nonce;
    if (replacing.crossOrigin) s.crossOrigin = replacing.crossOrigin;
    if (replacing.integrity) s.integrity = replacing.integrity;
    if (replacing.referrerPolicy) s.referrerPolicy = replacing.referrerPolicy;
    replacing.replaceWith(s);
  } else {
    document.head.appendChild(s);
  }
  return s;
}

// What Resource Timing lets this page see about a script URL. The status needs a
// Timing-Allow-Origin header from the host; without it only the duration is visible.
function measured(src: string): string {
  const entry = performance.getEntriesByName(src).pop() as PerformanceResourceTiming | undefined;
  if (!entry) return '';
  const after = `after ${Math.round(entry.duration)}ms`;
  return entry.responseStatus ? ` (HTTP ${entry.responseStatus} ${after})` : ` (${after}, no status visible)`;
}

// a tag we did NOT create (hand-added by the consumer) has no ready promise — adopt it.
// Its load/error may have fired BEFORE adoption and will never re-fire, so the adopted
// path also polls the global briefly and then fails loudly instead of hanging forever.
// Our own tag keeps pure event semantics (no deadline — slow networks must not reject).
function watch(w: WhopWindow, script: WhopScript, created: boolean): WhopLoad {
  if (!script.__whopReady) {
    script.__whopReady = withRetry(
      new Promise<unknown>((resolve, reject) => {
        let timer: ReturnType<typeof setInterval> | null = null;
        function settle<T>(fn: (v: T) => void, v: T): void {
          if (timer !== null) {
            clearInterval(timer);
            timer = null;
          }
          fn(v);
        }
        function fail(message: string): void {
          script.__whopFailed = true;
          settle(reject, new Error(message));
        }
        script.addEventListener('load', () => {
          if (w.WhopElements) settle(resolve, w.WhopElements);
          else fail('WhopElements loaded but did not initialize');
        });
        script.addEventListener('error', () => fail('Failed to load ' + script.src + measured(script.src)));
        if (!created) {
          let waited = 0;
          timer = setInterval(() => {
            if (w.WhopElements) {
              settle(resolve, w.WhopElements);
              return;
            }
            waited += 200;
            if (waited >= 10000)
              fail(
                'existing data-whop-elements script did not initialize within 10s — if its network load already failed before loadWhop() ran (check the console/CSP), no load/error event will ever fire on it',
              );
          }, 200);
        }
      }),
    );
  }
  return script.__whopReady;
}

function environmentOf(environment: unknown): 'production' | 'sandbox' {
  if (environment === undefined || environment === 'production') return 'production';
  if (environment === 'sandbox') return 'sandbox';
  throw new Error(`unknown environment ${JSON.stringify(environment)}: expected "production" or "sandbox"`);
}

function apiOrigin(environment: unknown): string {
  return API_ORIGINS[environmentOf(environment)];
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface PreloadHint {
  rel: string;
  href: string;
  as?: string;
  crossOrigin?: 'anonymous';
}

// An array of hints (existing array usage keeps working) plus ways to apply it.
class PreloadHints extends Array<PreloadHint> {
  // map/flatMap produce plain arrays: rendered <link> tags are not a hint list. The methods below
  // keep hints as hints, so a narrowed list still has toLinkHeader() and friends.
  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  filter<S extends PreloadHint>(
    predicate: (value: PreloadHint, index: number, array: PreloadHint[]) => value is S,
    thisArg?: unknown,
  ): PreloadHints & S[];
  filter(
    predicate: (value: PreloadHint, index: number, array: PreloadHint[]) => unknown,
    thisArg?: unknown,
  ): PreloadHints;
  filter(
    predicate: (value: PreloadHint, index: number, array: PreloadHint[]) => unknown,
    thisArg?: unknown,
  ): PreloadHints {
    return hintsFrom(super.filter(predicate, thisArg));
  }

  slice(start?: number, end?: number): PreloadHints {
    return hintsFrom(super.slice(start, end));
  }

  concat(...items: (PreloadHint | ConcatArray<PreloadHint>)[]): PreloadHints {
    return hintsFrom(super.concat(...items));
  }

  // copies sorted or reversed without Array.prototype.toSorted/toReversed, which older browsers lack.
  toSorted(compareFn?: (a: PreloadHint, b: PreloadHint) => number): PreloadHints {
    return hintsFrom(this).sort(compareFn);
  }

  toReversed(): PreloadHints {
    const hints = hintsFrom(this);
    hints.reverse();
    return hints;
  }

  toLinkHeader(): string {
    return this.map(
      (h) =>
        `<${h.href}>; rel=${h.rel}${h.as ? `; as=${h.as}` : ''}${h.crossOrigin ? `; crossorigin=${h.crossOrigin}` : ''}`,
    ).join(', ');
  }

  toHtml(): string {
    return this.map(
      (h) =>
        `<link rel="${escapeAttribute(h.rel)}" href="${escapeAttribute(h.href)}"${h.as ? ` as="${escapeAttribute(h.as)}"` : ''}${h.crossOrigin ? ` crossorigin="${h.crossOrigin}"` : ''}>`,
    ).join('\n');
  }

  applyTo(headers: Headers): void {
    const value = this.toLinkHeader();
    if (value) headers.append('Link', value);
  }
}

function hintsFrom(items: Iterable<PreloadHint>): PreloadHints {
  const hints = new PreloadHints();
  for (const item of items) hints.push(item);
  return hints;
}

// Resource hints for consumers who want to warm the SDK fetch from <head>. SDK_URL carries the
// train, so these auto-follow a major bump of this package — no hardcoded version to update.
// The Whop API connection for `environment` (production unless set), and every group's scripts and
// connections unless its key is false. Unknown keys are ignored.
function preloadHints(options: Record<string, unknown> = {}): PreloadHints {
  const hints = new PreloadHints();
  const add = (hint: PreloadHint) => {
    if (!hints.some((h) => h.rel === hint.rel && h.href === hint.href && h.crossOrigin === hint.crossOrigin))
      hints.push(hint);
  };
  add({ rel: 'preconnect', href: ORIGIN });
  add({ rel: 'preload', href: SDK_URL, as: 'script' });
  add({ rel: 'preconnect', href: apiOrigin(options.environment), crossOrigin: 'anonymous' });
  const environment = environmentOf(options.environment);
  for (const [group, byEnvironment] of Object.entries(PAGE_REQUIREMENTS)) {
    if (options[group] === false) continue;
    for (const hint of byEnvironment[environment].hints) add(hint);
  }
  return hints;
}

// When a page doesn't set a directive, the browser applies the next one in its fallback chain.
const FALLBACKS = {
  'frame-src': ['child-src', 'default-src'],
  'script-src': ['default-src'],
  'connect-src': ['default-src'],
  'img-src': ['default-src'],
};
type Sources = Record<keyof typeof FALLBACKS, readonly string[]>;
const POLICY_HEADERS = ['Content-Security-Policy', 'Content-Security-Policy-Report-Only'];

interface ParsedDirective {
  name: string;
  values: string[];
}

const camelToKebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const kebabToCamel = (key: string) => key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

// Adds the sources to a directive's values: `'none'` goes (it forbids everything), duplicates don't repeat.
function addSources<T>(values: T[], sources: readonly string[]): (T | string)[] {
  const out: (T | string)[] = values.filter((v) => typeof v !== 'string' || v.toLowerCase() !== "'none'");
  for (const source of sources) if (!out.includes(source)) out.push(source);
  return out;
}

// Merges the sources into one policy string's directives, in place. A directive the policy sets
// gets them added (and `script-src-elem`, which governs <script> tags when present, too). A
// directive it doesn't set is only added when a fallback applies, starting from the fallback's
// values, since an unset directive with no fallback already allows everything.
function mergeDirectives(directives: ParsedDirective[], sources: Sources): void {
  for (const [name, list] of Object.entries(sources) as [keyof Sources, readonly string[]][]) {
    if (list.length === 0) continue;
    const own = directives.find((d) => d.name === name);
    const elem = name === 'script-src' ? directives.find((d) => d.name === 'script-src-elem') : undefined;
    if (elem) elem.values = addSources(elem.values, list);
    if (own) {
      own.values = addSources(own.values, list);
      continue;
    }
    const fallback = FALLBACKS[name].map((f) => directives.find((d) => d.name === f)).find((d) => d !== undefined);
    if (fallback) directives.push({ name, values: addSources([...fallback.values], list) });
  }
}

function parsePolicy(policy: string): ParsedDirective[] {
  const directives: ParsedDirective[] = [];
  for (const part of policy.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/).filter(Boolean);
    // a repeated directive is ignored by the browser, so only the first counts.
    if (name && !directives.some((d) => d.name === name.toLowerCase()))
      directives.push({ name: name.toLowerCase(), values });
  }
  return directives;
}

const serializePolicy = (directives: ParsedDirective[]) =>
  directives.map((d) => [d.name, ...d.values].join(' ')).join('; ');

// What helmet sends for a directive the object leaves out (useDefaults: true). The others it leaves
// to the browser, which falls back to `default-src`.
const HELMET_DEFAULTS: Partial<Record<keyof Sources, readonly string[]>> = {
  'script-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
};

// Merges the sources into a directives object in helmet's shape, whose default (useDefaults: true)
// fills every key the object leaves out: `default-src 'self'`, `script-src 'self'`, `img-src 'self'
// data:`, and so on. So each of our directives is always written, starting from what helmet would
// otherwise send for it: the object's own value, else helmet's default for it, else its fallback
// (`child-src`, then `default-src`), else `'self'`. Other keys, and their values, are returned
// untouched.
function mergeHelmetDirectives(policy: Record<string, unknown>, sources: Sources): Record<string, unknown> {
  const keys = Object.keys(policy);
  const camel = keys.length > 0 && keys.every((k) => !k.includes('-'));
  const keyOf = (name: string) => keys.find((k) => camelToKebab(k) === name);
  // a string or any other iterable (an array, a Set, an iterator) is a value, read ONCE: an iterator
  // is spent by one read, and a directive can seed several fallbacks. helmet reads null as "leave
  // this directive out".
  const read = new Map<string, unknown[]>();
  const valuesOf = (key: string | undefined): unknown[] | undefined => {
    if (key === undefined) return undefined;
    const seen = read.get(key);
    if (seen) return [...seen];
    const value = policy[key];
    const values =
      typeof value === 'string'
        ? value.split(/\s+/).filter(Boolean)
        : value != null && typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function'
          ? [...(value as Iterable<unknown>)]
          : undefined;
    if (values) read.set(key, values);
    return values && [...values];
  };
  const isIterator = (value: unknown): boolean =>
    value != null &&
    typeof (value as Iterator<unknown>).next === 'function' &&
    (value as Iterable<unknown>)[Symbol.iterator]?.() === value;
  // written back in the container the directive came in, so the returned object keeps the input's
  // shape: an iterator comes back as a fresh one over the same values
  const shaped = (key: string, values: unknown[]): unknown => {
    const value = policy[key];
    if (typeof value === 'string') return values.join(' ');
    if (value instanceof Set) return new Set(values);
    return isIterator(value) ? values.values() : values;
  };
  const out: Record<string, unknown> = { ...policy };
  for (const [name, list] of Object.entries(sources) as [keyof Sources, readonly string[]][]) {
    if (list.length === 0) continue;
    const ownKey = keyOf(name);
    const own = valuesOf(ownKey);
    // Left out, script-src and img-src take helmet's own defaults; set to null, helmet sends none and
    // the browser falls back to default-src, like the other directives always do.
    const helmetDefault = ownKey !== undefined && policy[ownKey] === null ? undefined : HELMET_DEFAULTS[name];
    const seed = own ??
      (helmetDefault
        ? [...helmetDefault]
        : FALLBACKS[name].map((f) => valuesOf(keyOf(f))).find((v) => v !== undefined)) ?? ["'self'"];
    const merged = addSources(seed, list);
    const key = ownKey ?? (camel ? kebabToCamel(name) : name);
    out[key] = shaped(key, merged);
    if (name === 'script-src') {
      const elemKey = keyOf('script-src-elem');
      const elem = valuesOf(elemKey);
      if (elemKey !== undefined && elem) out[elemKey] = shaped(elemKey, addSources(elem, list));
    }
  }
  // a directive only read (a fallback) was spent if it was an iterator: hand back its values
  for (const [key, values] of read) if (out[key] === policy[key] && isIterator(policy[key])) out[key] = values.values();
  return out;
}

// The sources elements need on the page, and ways to merge them into a policy.
class ContentSecurityPolicy {
  readonly directives: Readonly<Sources>;

  constructor(directives: Record<keyof Sources, string[]>) {
    this.directives = Object.freeze({
      'frame-src': Object.freeze([...directives['frame-src']]),
      'script-src': Object.freeze([...directives['script-src']]),
      'connect-src': Object.freeze([...directives['connect-src']]),
      'img-src': Object.freeze([...directives['img-src']]),
    });
  }

  // A directive with no sources is left out: written bare, it would allow nothing.
  toString(): string {
    return serializePolicy(
      Object.entries(this.directives)
        .filter(([, values]) => values.length > 0)
        .map(([name, values]) => ({ name, values: [...values] })),
    );
  }

  merge(policy: string): string;
  merge<T extends Record<string, unknown>>(directives: T): T;
  merge(policy: string | Record<string, unknown>): string | Record<string, unknown> {
    if (typeof policy !== 'string') return mergeHelmetDirectives(policy, this.directives);
    // A header carrying several policies joins them with commas; each is enforced on its own.
    return policy
      .split(',')
      .map((one) => {
        const directives = parsePolicy(one);
        mergeDirectives(directives, this.directives);
        return serializePolicy(directives);
      })
      .join(', ');
  }

  applyTo(headers: Headers): void {
    for (const name of POLICY_HEADERS) {
      const value = headers.get(name);
      if (value !== null) headers.set(name, this.merge(value));
    }
  }

  toHtml(policy: string): string {
    return `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(this.merge(policy))}">`;
  }
}

// The sources elements need: the hosted frames and SDK, the Whop API for the environment, and every
// group's origins for that environment, including what the vendor scripts it loads reach, unless
// its key is false.
function contentSecurityPolicy(options: Record<string, unknown> = {}): ContentSecurityPolicy {
  const directives: Record<keyof Sources, string[]> = {
    'frame-src': [ORIGIN],
    'script-src': [ORIGIN],
    'connect-src': [apiOrigin(options.environment)],
    'img-src': [],
  };
  const environment = environmentOf(options.environment);
  for (const [group, byEnvironment] of Object.entries(PAGE_REQUIREMENTS)) {
    if (options[group] === false) continue;
    for (const [name, list] of Object.entries(byEnvironment[environment].sources) as [keyof Sources, string[]][]) {
      for (const source of list) if (!directives[name].includes(source)) directives[name].push(source);
    }
  }
  return new ContentSecurityPolicy(directives);
}

export { SDK_URL, WHOP_ELEMENTS_LOCALES, contentSecurityPolicy, loadWhop, preloadHints };
