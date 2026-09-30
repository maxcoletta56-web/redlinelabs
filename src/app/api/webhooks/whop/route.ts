import { handleWhopWebhook } from "@/lib/whop-webhook";

export const dynamic = "force-dynamic";

/** Whop signs the raw body. Do not parse JSON before verification. */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleWhopWebhook(rawBody, request.headers);
  return new Response(result.outcome === "unauthorized" ? "invalid signature" : "ok", {
    status: result.status,
  });
}
