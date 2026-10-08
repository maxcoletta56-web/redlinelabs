export type WhopEmbedAddress = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

/** Passed to the browser embed. Contains no API key. */
export type WhopEmbedSession = {
  sessionId: string;
  planId: string;
  reference: string;
  environment: "sandbox" | "production";
  returnUrl: string;
  email: string;
  totalCents: number;
  address: WhopEmbedAddress;
};
