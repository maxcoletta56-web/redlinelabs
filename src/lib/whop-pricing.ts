/** Major-unit AUD amount for Whop `initial_price`, from integer cents. */
export function centsToAud(cents: number) {
  const rounded = Math.round(cents);
  const sign = rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);
  const whole = Math.trunc(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return Number(`${sign}${whole}.${fraction}`);
}

export type WhopCheckoutBody = {
  account_id: string;
  redirect_url: string;
  metadata: { orderId: string; order_id: string };
  mode: "payment";
  plan: {
    currency: "aud";
    initial_price: number;
    plan_type: "one_time";
    force_create_new_plan: true;
    visibility: "hidden";
    title: string;
    three_ds_level: "frictionless_if_required";
    payment_method_configuration: {
      enabled: ["card"];
      include_platform_defaults: false;
    };
  };
};

/**
 * Inline one-time plan in AUD. `three_ds_level` is the regular frictionless
 * flow: the issuer can still require a challenge, including the sandbox 3DS
 * card, and payments of $1,000 or more are challenged when the processor
 * requires it. Card is the only method so Whop's own bank transfer is not
 * offered beside the shop's PayID option.
 */
export function whopCheckoutBody(input: {
  companyId: string;
  reference: string;
  totalCents: number;
  returnUrl: string;
}): WhopCheckoutBody {
  return {
    account_id: input.companyId,
    redirect_url: input.returnUrl,
    metadata: { orderId: input.reference, order_id: input.reference },
    mode: "payment",
    plan: {
      currency: "aud",
      initial_price: centsToAud(input.totalCents),
      plan_type: "one_time",
      force_create_new_plan: true,
      visibility: "hidden",
      title: `Redline Labs ${input.reference}`,
      three_ds_level: "frictionless_if_required",
      payment_method_configuration: {
        enabled: ["card"],
        include_platform_defaults: false,
      },
    },
  };
}
