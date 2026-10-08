/**
 * Where the join popup may appear. Catalogue and cart routes only: never
 * checkout, the order page, /club itself or anywhere else where it would
 * interrupt a customer who is paying, already joining, or reading an order.
 */
export const CLUB_INVITE_ROUTES = ["/shop", "/product", "/cart"] as const;

export function shouldInviteOnPath(pathname: string) {
  return CLUB_INVITE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
