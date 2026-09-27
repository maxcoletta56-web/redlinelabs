import { startStoredCheckout } from "@/lib/checkout-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return startStoredCheckout(request, "bank_transfer");
}
