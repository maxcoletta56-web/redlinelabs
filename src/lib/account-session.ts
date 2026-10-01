export const ACCOUNT_SESSION_KEY = "redline-session-v1";
export const ACCOUNT_SESSION_COOKIE = "rl_account_session";

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type SessionCookieJar = {
  read(): string | null;
  write(email: string): void;
  clear(): void;
};

export type AccountSession = {
  email: string | null;
  remember: boolean;
};

function readStoredEmail(store: KeyValueStore): string | null {
  try {
    const raw = store.getItem(ACCOUNT_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "string" && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function ignoreStorageError(action: () => void) {
  try {
    action();
  } catch {
    /* private mode or a full quota should not block sign-in in memory */
  }
}

export function readSessionCookie(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== ACCOUNT_SESSION_COOKIE) continue;
    const raw = part.slice(separator + 1).trim();
    if (!raw) return null;
    try {
      const email = decodeURIComponent(raw);
      return email.length > 0 ? email : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function formatSessionCookie(email: string, secure: boolean) {
  const secureAttr = secure ? "; Secure" : "";
  return `${ACCOUNT_SESSION_COOKIE}=${encodeURIComponent(email)}; Path=/; SameSite=Lax${secureAttr}`;
}

export function formatClearSessionCookie(secure: boolean) {
  const secureAttr = secure ? "; Secure" : "";
  return `${ACCOUNT_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr}`;
}

export function browserSessionCookie(documentCookie: {
  cookie: string;
}, secure: boolean): SessionCookieJar {
  return {
    read() {
      try {
        return readSessionCookie(documentCookie.cookie);
      } catch {
        return null;
      }
    },
    write(email) {
      documentCookie.cookie = formatSessionCookie(email, secure);
    },
    clear() {
      documentCookie.cookie = formatClearSessionCookie(secure);
    },
  };
}

/**
 * A session cookie wins when both stores have a sign-in, so signing in
 * without Remember me replaces an older persistent login.
 * Logged-out reads default to remembering, matching the checkbox.
 */
export function readAccountSession(
  persistent: KeyValueStore,
  sessionCookie: SessionCookieJar,
): AccountSession {
  let cookieEmail: string | null = null;
  try {
    cookieEmail = sessionCookie.read();
  } catch {
    cookieEmail = null;
  }
  if (cookieEmail) return { email: cookieEmail, remember: false };
  const persistentEmail = readStoredEmail(persistent);
  if (persistentEmail) return { email: persistentEmail, remember: true };
  return { email: null, remember: true };
}

export function writeAccountSession(
  persistent: KeyValueStore,
  sessionCookie: SessionCookieJar,
  session: AccountSession,
) {
  const email = session.email;
  if (!email) {
    ignoreStorageError(() => persistent.removeItem(ACCOUNT_SESSION_KEY));
    ignoreStorageError(() => sessionCookie.clear());
    return;
  }
  if (session.remember) {
    ignoreStorageError(() => sessionCookie.clear());
    ignoreStorageError(() => {
      persistent.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(email));
    });
    return;
  }
  ignoreStorageError(() => persistent.removeItem(ACCOUNT_SESSION_KEY));
  ignoreStorageError(() => sessionCookie.write(email));
}
