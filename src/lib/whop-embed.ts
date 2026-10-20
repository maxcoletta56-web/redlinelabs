/** Client-safe description of an embedded Whop checkout. No secrets. */
export type WhopEmbedSession = {
  sessionId: string;
  planId: string | null;
  returnUrl: string;
  environment: "sandbox" | "production";
  reference: string;
  email: string;
  /** Server-calculated total, in cents. Display only; the charge uses the configuration. */
  amountCents: number;
};
