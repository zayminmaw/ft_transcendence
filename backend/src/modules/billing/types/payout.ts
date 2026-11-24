export type PayoutView = {
  id: string;
  clientId: string;
  wireReference: string;
  amount: string;
  balanceAfter: string;
  createdAt: string;
  // True when the same wire reference was sent before: nothing new was recorded.
  repeated: boolean;
};
