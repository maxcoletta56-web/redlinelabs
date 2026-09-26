export type BankDetails = {
  accountName: string;
  bsb: string;
  accountNumber: string;
};

export function bankDetails(env: Record<string, string | undefined>): BankDetails | null {
  const accountName = env.BANK_ACCOUNT_NAME?.trim() ?? "";
  const bsb = env.BANK_BSB?.trim() ?? "";
  const accountNumber = env.BANK_ACCOUNT_NUMBER?.trim() ?? "";
  if (!accountName || !bsb || !accountNumber) return null;
  return { accountName, bsb, accountNumber };
}
