/**
 * Where the join banner may appear. Home, catalogue and cart: never checkout,
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
