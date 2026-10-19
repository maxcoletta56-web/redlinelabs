import { clubCancelPost } from "@/lib/club-api";

export function POST(request: Request) {
  return clubCancelPost(request);
}
