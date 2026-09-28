/** Whop appends this after 3D Secure and other full-page next actions. */
export type CheckoutReturnStatus = "success" | "error" | "pending";

export function checkoutReturnStatus(value: string | null | undefined): CheckoutReturnStatus {
  const status = value?.trim().toLowerCase();
  if (status === "success") return "success";
  if (status === "error") return "error";
  return "pending";
}
