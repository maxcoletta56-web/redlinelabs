import { NextResponse } from "next/server";
import { handleWhopWebhook } from "@/lib/whop-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const result = await handleWhopWebhook(rawBody, request.headers);
  return NextResponse.json(result.body, { status: result.status });
}
