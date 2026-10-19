import { clubStatusPost } from "@/lib/club-api";

export function POST(request: Request) {
  return clubStatusPost(request);
}
