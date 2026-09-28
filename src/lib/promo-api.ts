import { lookupPromo } from "./promo.ts";

export async function promoPost(request: Request): Promise<Response> {
  let code: unknown;
  try {
    const json: unknown = await request.json();
    if (json && typeof json === "object" && "code" in json) {
      code = json.code;
    }
  } catch {
    code = undefined;
  }

  const promo = typeof code === "string" ? lookupPromo(code) : null;
  if (!promo) {
    return Response.json({ error: "Invalid code" }, { status: 404 });
  }

  return Response.json({
    code: promo.code,
    percentOff: promo.percentOff,
    name: promo.name,
  });
}
