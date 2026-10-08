import { clubQuotePost } from "@/lib/club-api";

export function POST(request: Request) {
  return clubQuotePost(request);
}
