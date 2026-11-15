// Who may hand a driver's cash over to the books: the cashier's approval.
export const RECONCILE_PERMISSION = 'billing.reconcile_cod';

export const COD_DRIVER_NOT_FOUND = { message: "That driver isn't in this company.", code: 'COD_DRIVER_NOT_FOUND' };
export const COD_PARCELS_NOT_ELIGIBLE = {
  message: "Some of these parcels can't be settled. They must be delivered by this driver, in this company, and not settled before.",
  code: 'COD_PARCELS_NOT_ELIGIBLE',
};
export const COD_REFERENCE_REUSED = { message: 'This settlement reference was used for another driver.', code: 'COD_REFERENCE_REUSED' };
// The cash must be exactly what the parcels were collected for, DEC-13's zero tolerance. A handover that differs is
// refused and nothing is stored. The amounts are in the message, because only the message and code reach the client.
export const codDiscrepancy = (expected: string, counted: string) => ({
  message: `The cash counted is ${counted} but these parcels were collected for ${expected}, so the handover was not recorded.`,
  code: 'COD_DISCREPANCY',
});
// A merchant's pending COD is lower than the cash of its parcels in this handover. The cash enters pending when the
// delivery is recorded, so these parcels did not go through the delivery step.
export const COD_PENDING_TOO_LOW = {
  message: "A merchant's pending COD is lower than these parcels' cash, so the handover was not recorded. Record their delivery first.",
  code: 'COD_PENDING_TOO_LOW',
};
