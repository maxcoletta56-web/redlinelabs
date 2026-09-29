import { promoPost } from "@/lib/promo-api";

export function POST(request: Request) {
  return promoPost(request);
}
