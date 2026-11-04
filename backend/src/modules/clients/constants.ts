// The rate profiles a merchant can be on. The column is free text, so this list is the rule.
export const RATE_TIERS = ['standard', 'priority', 'corporate'] as const;
export type RateTier = (typeof RATE_TIERS)[number];

export const CLIENT_STATUSES = ['active', 'archived', 'all'] as const;
export const CLIENT_SORTS = ['businessName', 'clientCode', 'createdAt'] as const;

// Who may see a merchant's balances and rate tier, and change the tier.
export const FINANCIALS_PERMISSION = 'clients.view_financials';

export const CLIENT_NOT_FOUND = { message: "That client isn't in this company.", code: 'CLIENT_NOT_FOUND' };
export const CLIENT_CODE_TAKEN = { message: 'This client code is already used.', code: 'CLIENT_CODE_TAKEN' };
export const CLIENT_FINANCIALS_FORBIDDEN = {
  message: "You can't change a client's rate tier.",
  code: 'CLIENT_FINANCIALS_FORBIDDEN',
};
export const CLIENT_COORDINATES_UNPAIRED = {
  message: 'Send the pickup latitude and longitude together, or neither.',
  code: 'CLIENT_COORDINATES_UNPAIRED',
};
