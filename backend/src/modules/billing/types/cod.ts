// A delivered parcel waiting for its cash to be checked.
export type DeliveredParcel = {
  id: string;
  trackingNumber: string;
  clientId: string;
  codAmount: string;
  deliveryFee: string;
  deliveredAt: Date | null;
};

export type SettlementView = {
  id: string;
  reference: string;
  driverId: string;
  status: 'pending' | 'verified' | 'discrepancy_flagged';
  totalCodExpected: string;
  totalCashDropped: string;
  discrepancyAmount: string;
  settledAt: string;
  parcels: { id: string; trackingNumber: string; codAmount: string }[];
  // True when the same reference was sent before: nothing new was recorded.
  repeated: boolean;
};

export type UnreconciledView = {
  driverId: string;
  expectedTotal: string;
  parcels: { id: string; trackingNumber: string; clientId: string; codAmount: string; deliveredAt: string | null }[];
};
