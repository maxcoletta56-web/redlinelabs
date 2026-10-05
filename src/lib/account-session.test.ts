import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_SESSION_COOKIE,
  ACCOUNT_SESSION_KEY,
  browserSessionCookie,
  formatClearSessionCookie,
  formatSessionCookie,
  readAccountSession,
  readSessionCookie,
  writeAccountSession,
  type KeyValueStore,
  type SessionCookieJar,
} from "./account-session.ts";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key]! : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

function memoryCookie(initial: string | null = null): SessionCookieJar & { email: string | null } {
  return {
    email: initial,
    read() {
      return this.email;
    },
    write(email) {
      this.email = email;
    },
    clear() {
      this.email = null;
    },
  };
}

test("a signed-out browser defaults to remembering the next login", () => {
  const session = readAccountSession(memoryStore(), memoryCookie());
  assert.deepEqual(session, { email: null, remember: true });
});

test("remember me keeps the session in local storage and clears the cookie", () => {
  const persistent = memoryStore();
  const cookie = memoryCookie("old@example.com");

  writeAccountSession(persistent, cookie, {
    email: "max@example.com",
    remember: true,
  });

  assert.equal(persistent.data[ACCOUNT_SESSION_KEY], JSON.stringify("max@example.com"));
  assert.equal(cookie.email, null);
  assert.deepEqual(readAccountSession(persistent, cookie), {
    email: "max@example.com",
    remember: true,
  });
});

test("leaving remember me unchecked uses a session cookie only", () => {
  const persistent = memoryStore({
    [ACCOUNT_SESSION_KEY]: JSON.stringify("max@example.com"),
    "redline-accounts-v1": "[]",
  });
  const cookie = memoryCookie();

  writeAccountSession(persistent, cookie, {
    email: "max@example.com",
    remember: false,
  });

  assert.equal(persistent.data[ACCOUNT_SESSION_KEY], undefined);
  assert.equal(persistent.data["redline-accounts-v1"], "[]");
  assert.equal(cookie.email, "max@example.com");
  assert.deepEqual(readAccountSession(persistent, cookie), {
    email: "max@example.com",
    remember: false,
  });
});

test("a session cookie replaces a remembered login", () => {
  const persistent = memoryStore({
    [ACCOUNT_SESSION_KEY]: JSON.stringify("remembered@example.com"),
  });
  const cookie = memoryCookie("tab@example.com");

  assert.deepEqual(readAccountSession(persistent, cookie), {
    email: "tab@example.com",
    remember: false,
  });
});

test("signing out clears local storage and the session cookie", () => {
  const persistent = memoryStore({
    [ACCOUNT_SESSION_KEY]: JSON.stringify("max@example.com"),
  });
  const cookie = memoryCookie("max@example.com");

  writeAccountSession(persistent, cookie, { email: null, remember: true });

  assert.deepEqual(readAccountSession(persistent, cookie), {
    email: null,
    remember: true,
  });
});

test("session cookie formatting is a browser session, not a persistent cookie", () => {
  const written = formatSessionCookie("max+lab@example.com", true);
  assert.equal(
    written,
    `${ACCOUNT_SESSION_COOKIE}=max%2Blab%40example.com; Path=/; SameSite=Lax; Secure`,
  );
  assert.equal(written.includes("Max-Age"), false);
  assert.equal(written.includes("Expires"), false);
  assert.equal(readSessionCookie(written), "max+lab@example.com");
  assert.equal(
    readSessionCookie(`theme=dark; ${formatSessionCookie("max@example.com", false)}`),
    "max@example.com",
  );
  assert.equal(readSessionCookie("theme=dark"), null);
  assert.equal(readSessionCookie(`${ACCOUNT_SESSION_COOKIE}=`), null);
  assert.match(formatClearSessionCookie(false), /Max-Age=0/);
});

test("the browser cookie jar reads and writes document.cookie", () => {
  const documentCookie = { cookie: "" };
  const jar = browserSessionCookie(documentCookie, false);
  jar.write("max@example.com");
  assert.equal(documentCookie.cookie.includes("Max-Age"), false);
  assert.equal(jar.read(), "max@example.com");
  jar.clear();
  assert.match(documentCookie.cookie, /Max-Age=0/);
  assert.equal(readSessionCookie(documentCookie.cookie), null);
});

test("malformed session values are ignored", () => {
  const persistent = memoryStore({ [ACCOUNT_SESSION_KEY]: "{not json" });
  assert.deepEqual(readAccountSession(persistent, memoryCookie()), {
    email: null,
    remember: true,
  });

  const empty = memoryStore({ [ACCOUNT_SESSION_KEY]: JSON.stringify("") });
  assert.equal(readAccountSession(empty, memoryCookie()).email, null);
  assert.equal(readSessionCookie(`${ACCOUNT_SESSION_COOKIE}=%`), null);
});

test("storage failures do not throw", () => {
  const broken: KeyValueStore = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  const cookie: SessionCookieJar = {
    read() {
      throw new Error("blocked");
    },
    write() {
      throw new Error("blocked");
    },
    clear() {
      throw new Error("blocked");
    },
  };

  assert.deepEqual(readAccountSession(broken, cookie), {
    email: null,
    remember: true,
  });
  assert.doesNotThrow(() => {
    writeAccountSession(broken, cookie, {
      email: "max@example.com",
      remember: false,
    });
  });
});
