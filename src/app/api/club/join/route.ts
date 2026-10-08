import { clubJoinPost } from "@/lib/club-api";

export function POST(request: Request) {
  return clubJoinPost(request);
}
