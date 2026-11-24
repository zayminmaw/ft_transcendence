// Who may pay a merchant out of its balance. This is a balance change by finance, so it uses the existing balance
// adjustment permission rather than a new one.
export const PAYOUT_PERMISSION = 'billing.adjust_balance';

export const PAYOUT_MERCHANT_NOT_FOUND = { message: "That merchant isn't in this company.", code: 'PAYOUT_MERCHANT_NOT_FOUND' };
export const PAYOUT_EXCEEDS_BALANCE = {
  message: 'The payout is more than the merchant is owed, so it was not recorded.',
  code: 'PAYOUT_EXCEEDS_BALANCE',
};
export const PAYOUT_REFERENCE_REUSED = {
  message: 'This wire reference was already used for a different amount.',
  code: 'PAYOUT_REFERENCE_REUSED',
};
