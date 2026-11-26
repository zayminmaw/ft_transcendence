import type { InvoiceStatus } from '../entities/invoice.entity';

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

// One row returned by the repository for list/export views, joined with its merchant.
export type InvoiceListRecord = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  totalDeliveries: number;
  totalDeliveryFees: string;
  totalCodCollected: string;
  netAmountDue: string;
  createdAt: Date;
};

// Company-wide (or merchant-scoped) invoice totals for summary strips.
export type InvoiceSummaryStats = {
  total: number;
  draft: number;
  issued: number;
  paid: number;
  overdue: number;
  totalDeliveryFees: string;
};

// A delivered parcel that can go on an invoice.
export type BillableParcel = { id: string; trackingNumber: string; deliveryFee: string };
