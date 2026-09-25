import { NextResponse } from "next/server";
import { COMPANY_EMAIL } from "@/lib/company";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { contactBodySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const limited = rateLimit(`contact:${clientKey(request)}`, 5, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many contact attempts. Try again in a few minutes." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) },
      },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid contact payload" }, { status: 400 });
  }

  const parsed = contactBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the form and try again" },
      { status: 400 },
    );
  }

  if (parsed.data.company) {
    return NextResponse.json({ ok: true });
  }

  const subject = `Catalogue enquiry from ${parsed.data.name}`;
  const body = [`Name: ${parsed.data.name}`, `Email: ${parsed.data.email}`, "", parsed.data.message].join(
    "\n",
  );
  const mailto = `mailto:${COMPANY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return NextResponse.json({ ok: true, mailto });
}
