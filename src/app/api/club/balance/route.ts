import { clubBalancePost } from "@/lib/club-api";

export function POST(request: Request) {
  return clubBalancePost(request);
}
