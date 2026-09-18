"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  addAddress,
  addStockAlert,
  applyMateReferral,
  createUser,
  defaultAddress,
  hydrateAccountUsers,
  makeReferralCode,
  mergeOrders,
  normalizeEmail,
  normalizeReferralCode,
  publicAccount,
  recordOrder,
  removeAddress,
  removeStockAlert,
  setDefaultAddress,
  updateAddress,
  verifyPassword,
  type AccountUser,
  type AddressInput,
  type OrderRecord,
  type PublicAccount,
  type SignupInput,
} from "@/lib/account-data";

type AccountSnapshot = {
  user: PublicAccount | null;
  hydrated: boolean;
};

type AccountContextValue = AccountSnapshot & {
  signup: (input: SignupInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  saveAddress: (input: AddressInput, id?: string) => void;
  deleteAddress: (id: string) => void;
  makeDefaultAddress: (id: string) => void;
  watchProduct: (input: { slug: string; name: string; sku: string }) => void;
  unwatchProduct: (slug: string) => void;
  captureOrder: (order: OrderRecord) => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);
const USERS_KEY = "redline-accounts-v1";
const SESSION_KEY = "redline-session-v1";
const GUEST_ORDERS_KEY = "redline-guest-orders-v1";
const REFERRAL_KEY = "redline-referral-ref";

const loggedOut: AccountSnapshot = { user: null, hydrated: false };

let users: AccountUser[] = [];
let sessionEmail: string | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

function persist() {
  writeJson(USERS_KEY, users);
  if (sessionEmail) writeJson(SESSION_KEY, sessionEmail);
  else localStorage.removeItem(SESSION_KEY);
  emit();
}

function currentUser() {
  if (!sessionEmail) return null;
  return users.find((user) => user.email === sessionEmail) ?? null;
}

function replaceUser(next: AccountUser) {
  users = users.map((user) => (user.email === next.email ? next : user));
  persist();
}

let snapshotCache = loggedOut;
let publicCache: { raw: AccountUser | null; pub: PublicAccount | null } = {
  raw: null,
  pub: null,
};

function snapshot(): AccountSnapshot {
  const user = currentUser();
  if (publicCache.raw !== user) {
    publicCache = { raw: user, pub: user ? publicAccount(user) : null };
  }
  return {
    user: publicCache.pub,
    hydrated,
  };
}

function getSnapshot() {
  const next = snapshot();
  const prev = snapshotCache;
  if (prev.hydrated === next.hydrated && prev.user === next.user) {
    return prev;
  }
  snapshotCache = next;
  return snapshotCache;
}

function getServerSnapshot() {
  return loggedOut;
}

function readGuestOrders() {
  return readJson<OrderRecord[]>(GUEST_ORDERS_KEY, []);
}

function writeGuestOrders(orders: OrderRecord[]) {
  writeJson(GUEST_ORDERS_KEY, orders);
}

function claimGuestOrders(user: AccountUser) {
  const guest = readGuestOrders();
  if (guest.length === 0) return user;
  const claimed = mergeOrders(user, guest);
  writeGuestOrders(
    guest.filter((order) => normalizeEmail(order.email) !== user.email),
  );
  return claimed;
}

if (typeof window !== "undefined") {
  users = hydrateAccountUsers(readJson<AccountUser[]>(USERS_KEY, []));
  const stored = readJson<string | null>(SESSION_KEY, null);
  sessionEmail =
    typeof stored === "string" ? normalizeEmail(stored) : null;
  if (sessionEmail && !users.some((user) => user.email === sessionEmail)) {
    sessionEmail = null;
  }
  hydrated = true;
  persist();
  snapshotCache = snapshot();
}

export function rememberReferralCode(code: string | null | undefined) {
  const normalized = normalizeReferralCode(code);
  if (typeof window === "undefined") return normalized;
  if (normalized) writeJson(REFERRAL_KEY, normalized);
  return normalized;
}

export function pendingReferralCode() {
  if (typeof window === "undefined") return null;
  const stored = readJson<string | null>(REFERRAL_KEY, null);
  return normalizeReferralCode(stored);
}

function clearPendingReferralCode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REFERRAL_KEY);
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const signup = useCallback(async (input: SignupInput) => {
    const email = normalizeEmail(input.email);
    if (users.some((user) => user.email === email)) {
      throw new Error("An account with this email already exists");
    }
    let created = claimGuestOrders(await createUser(input));
    const taken = users.map((user) => user.referralCode);
    if (taken.includes(created.referralCode)) {
      created = { ...created, referralCode: makeReferralCode(created.firstName, taken) };
    }
    const applied = applyMateReferral(
      users,
      created,
      input.referralCode ?? pendingReferralCode(),
    );
    users = [...applied.users, applied.recruit];
    sessionEmail = applied.recruit.email;
    clearPendingReferralCode();
    persist();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const user = users.find((entry) => entry.email === normalizeEmail(email));
    if (!user || !(await verifyPassword(user, password))) {
      throw new Error("Email or password is incorrect");
    }
    const claimed = claimGuestOrders(user);
    if (claimed !== user) replaceUser(claimed);
    sessionEmail = user.email;
    persist();
  }, []);

  const logout = useCallback(() => {
    sessionEmail = null;
    persist();
  }, []);

  const saveAddress = useCallback((input: AddressInput, id?: string) => {
    const user = currentUser();
    if (!user) throw new Error("Sign in to save addresses");
    replaceUser(id ? updateAddress(user, id, input) : addAddress(user, input));
  }, []);

  const deleteAddress = useCallback((id: string) => {
    const user = currentUser();
    if (!user) throw new Error("Sign in to edit addresses");
    replaceUser(removeAddress(user, id));
  }, []);

  const makeDefaultAddress = useCallback((id: string) => {
    const user = currentUser();
    if (!user) throw new Error("Sign in to edit addresses");
    replaceUser(setDefaultAddress(user, id));
  }, []);

  const watchProduct = useCallback(
    (input: { slug: string; name: string; sku: string }) => {
      const user = currentUser();
      if (!user) throw new Error("Sign in to save stock alerts");
      replaceUser(addStockAlert(user, input));
    },
    [],
  );

  const unwatchProduct = useCallback((slug: string) => {
    const user = currentUser();
    if (!user) throw new Error("Sign in to edit stock alerts");
    replaceUser(removeStockAlert(user, slug));
  }, []);

  const captureOrder = useCallback((order: OrderRecord) => {
    const user = currentUser();
    if (user && normalizeEmail(order.email) === user.email) {
      replaceUser(recordOrder(user, order));
      return;
    }
    const guest = readGuestOrders();
    const exists = guest.some(
      (entry) =>
        entry.id === order.id ||
        (order.stripeSessionId && entry.stripeSessionId === order.stripeSessionId),
    );
    if (!exists) writeGuestOrders([order, ...guest]);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      signup,
      login,
      logout,
      saveAddress,
      deleteAddress,
      makeDefaultAddress,
      watchProduct,
      unwatchProduct,
      captureOrder,
    }),
    [
      state,
      signup,
      login,
      logout,
      saveAddress,
      deleteAddress,
      makeDefaultAddress,
      watchProduct,
      unwatchProduct,
      captureOrder,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within AccountProvider");
  return ctx;
}

export function useDefaultAddress() {
  const { user } = useAccount();
  return user ? defaultAddress(user) : null;
}
