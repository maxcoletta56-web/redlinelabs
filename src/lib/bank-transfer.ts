export type BankTransferEnv = Record<string, string | undefined>;

export type ResolvedBankTransfer = {
  payId: string;
  accountName: string;
};

export function resolveBankTransfer(env: BankTransferEnv): ResolvedBankTransfer | undefined {
  const payId = env.PAYID_ADDRESS?.trim() ?? "";
  const accountName = env.PAYID_ACCOUNT_NAME?.trim() ?? "";
  if (!payId || !accountName) return undefined;
  return { payId, accountName };
}

/** What the customer types into the transfer description so support can match it. */
export function transferDescription(reference: string) {
  return reference.trim().toUpperCase();
}
