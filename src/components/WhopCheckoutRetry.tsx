"use client";

import { WhopCardCheckout } from "@/components/WhopCardCheckout";

/** Remounts the embedded checkout after a 3D Secure or other redirect returns `status=error`. */
export function WhopCheckoutRetry({ reference, email }: { reference: string; email: string }) {
  return (
    <WhopCardCheckout
      items={[]}
      email={email}
      firstName=""
      lastName=""
      ageConfirmed
      researchUse
      existingReference={reference}
    />
  );
}
