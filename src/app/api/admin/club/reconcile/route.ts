import { clubAdminReconcilePost } from "@/lib/club-api";

export function POST(request: Request) {
  return clubAdminReconcilePost(request);
}
