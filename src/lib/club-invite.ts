/**
 * Where the join popup may appear. Home, catalogue and cart: never checkout,
 * the order page, /club itself or anywhere else where it would interrupt a
 * customer who is paying, already joining, or reading an order.
 * `/` is exact so it does not match every path.
 */
export const CLUB_INVITE_ROUTES = ["/", "/shop", "/product", "/cart"] as const;

export function shouldInviteOnPath(pathname: string) {
  return CLUB_INVITE_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * The popup stays mounted for the whole session. Hide it when the customer
 * leaves an invited route, including a client navigation onto checkout.
 * A dismissal is permanent; leaving the page is not.
 */
export function shouldKeepInviteOpen(pathname: string, seen: boolean) {
  return shouldInviteOnPath(pathname) && !seen;
}
