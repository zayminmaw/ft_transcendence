export type InvoiceItemView = {
  parcelId: string;
  trackingNumber: string;
  deliveryFee: string;
};

export type InvoiceView = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalDeliveries: number;
  totalDeliveryFees: string;
  netAmountDue: string;
  notes: string | null;
  items: InvoiceItemView[];
};

// A delivered parcel that can go on an invoice.
export type BillableParcel = { id: string; trackingNumber: string; deliveryFee: string };
