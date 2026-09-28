export type WhopEnvironment = "sandbox" | "production";

/** Fields the browser needs to mount the embedded checkout. */
export type WhopEmbeddedCheckout = {
  sessionId: string;
  planId: string;
  orderReference: string;
  environment: WhopEnvironment;
  returnUrl: string;
  totalCents: number;
};
