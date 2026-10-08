import { clubAdminAdjustPost } from "@/lib/club-api";

export async function POST(
  request: Request,
  context: { params: Promise<{ email: string }> },
) {
  const { email } = await context.params;
  return clubAdminAdjustPost(request, decodeURIComponent(email));
}
