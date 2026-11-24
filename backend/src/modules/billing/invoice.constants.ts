// Who may generate an invoice: the permission the seeds already define for "generate itemized billing statements".
export const INVOICE_PERMISSION = 'billing.create_invoice';

// Days between the issue date and the due date of a new invoice.
export const INVOICE_DUE_DAYS = 14;

export const INVOICE_MERCHANT_NOT_FOUND = { message: "That merchant isn't in this company.", code: 'INVOICE_MERCHANT_NOT_FOUND' };
export const INVOICE_BAD_PERIOD = { message: 'The period must end on or after the day it starts.', code: 'INVOICE_BAD_PERIOD' };
export const INVOICE_NOTHING_TO_BILL = {
  message: 'This merchant has no delivered parcels with a delivery fee in that period that are not already on an invoice.',
  code: 'INVOICE_NOTHING_TO_BILL',
};
