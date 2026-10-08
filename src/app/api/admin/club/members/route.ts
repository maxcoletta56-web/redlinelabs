import { clubAdminMembersGet } from "@/lib/club-api";

export function GET(request: Request) {
  return clubAdminMembersGet(request);
}
