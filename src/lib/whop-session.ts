export type WhopMode = "sandbox" | "production";

/** What the checkout page needs to mount the embedded card form. */
export type WhopEmbedSession = {
  planId: string;
  environment: WhopMode;
  returnUrl: string;
  email: string;
  reference: string;
};
