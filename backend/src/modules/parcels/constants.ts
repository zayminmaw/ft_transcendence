// `parcels.lifecycle_status` and `parcel_events.status`. A new parcel starts at pickup_scheduled: draft is in the
// schema for bulk uploads, which don't exist yet.
export const PARCEL_STATUSES = [
  'draft', 'pickup_scheduled', 'picked_up', 'in_hub_sorted', 'out_for_delivery', 'delivered', 'failed_attempt', 'returned_to_sender',
] as const;
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

// The moves POST /parcels/:id/status makes (parcels.update_status), each from the one status it may follow. Out for
// delivery comes only from an assignment (parcels.dispatch); delivered comes only from recording the delivery
// (parcels.mark_delivered), which requires proof and records the cash the driver collected.
export const STATUS_MOVES = {
  picked_up: 'pickup_scheduled',
  in_hub_sorted: 'picked_up',
  failed_attempt: 'out_for_delivery',
  returned_to_sender: 'failed_attempt',
} as const satisfies Partial<Record<ParcelStatus, ParcelStatus>>;
export type StatusMove = keyof typeof STATUS_MOVES;
export const STATUS_MOVE_TARGETS = Object.keys(STATUS_MOVES) as StatusMove[];

// A sorted parcel goes out for the first time; a failed attempt goes out again (a reattempt).
export const ASSIGNABLE_STATUSES = ['in_hub_sorted', 'failed_attempt'] as const satisfies readonly ParcelStatus[];

// Stored in `parcels.failed_reason_code` and the failed attempt's event.
export const FAILURE_REASONS = ['recipient_unavailable', 'address_not_found', 'refused', 'cod_not_ready'] as const;

// The list's queues: every parcel, the ones waiting for a driver, the exceptions, the ones a dispatcher can (re)assign,
// or one status.
export const PARCEL_QUEUES = {
  all: null,
  ready: ['in_hub_sorted'],
  exceptions: ['failed_attempt', 'returned_to_sender'],
  assignable: ASSIGNABLE_STATUSES,
} as const satisfies Record<string, readonly ParcelStatus[] | null>;
export const PARCEL_FILTERS = [...Object.keys(PARCEL_QUEUES), ...PARCEL_STATUSES] as (keyof typeof PARCEL_QUEUES | ParcelStatus)[];
export type ParcelFilter = (typeof PARCEL_FILTERS)[number];
export const PARCEL_SORTS = ['createdAt', 'tracking', 'merchant'] as const;

// The files proof of delivery keeps, by the name the API uses, with the `parcels` column holding each one's file id.
// The signature and photo are images; the delivery note (the paper the recipient signed) may also be a PDF. A
// delivery needs the signature and the photo; the note is optional.
export const PROOF_FILES = {
  signature: { column: 'signature_file_id', property: 'signatureFileId', pdf: false, required: true },
  photo: { column: 'doorstep_photo_file_id', property: 'doorstepPhotoFileId', pdf: false, required: true },
  note: { column: 'delivery_note_file_id', property: 'deliveryNoteFileId', pdf: true, required: false },
} as const;
export type ProofKind = keyof typeof PROOF_FILES;
export const PROOF_KINDS = Object.keys(PROOF_FILES) as ProofKind[];

// Drivers who are working: a parcel can go to them. Off duty and suspended drivers can't take parcels.
export const ON_DUTY_STATUSES = ['available', 'on_pickup', 'out_for_delivery'] as const;
// The checked-out assets a parcel can travel in.
export const VEHICLE_CATEGORIES = ['motorcycle', 'van'] as const;

export const PARCEL_NOT_FOUND = { message: "That parcel isn't in this company.", code: 'PARCEL_NOT_FOUND' };
export const PARCEL_CLIENT_UNAVAILABLE = {
  message: 'Choose an active merchant of this company.',
  code: 'PARCEL_CLIENT_UNAVAILABLE',
};
export const PARCEL_DRIVER_UNAVAILABLE = {
  message: 'Choose a driver of this company who is on duty.',
  code: 'PARCEL_DRIVER_UNAVAILABLE',
};
export const PARCEL_COD_MISMATCH = {
  message: "The cash collected isn't the amount due on the parcel, so the delivery was not recorded.",
  code: 'PARCEL_COD_MISMATCH',
};
export const PARCEL_NOT_YOUR_PARCEL = {
  message: 'This parcel is assigned to another driver.',
  code: 'PARCEL_NOT_YOUR_PARCEL',
};
export const PARCEL_WRONG_STATUS = {
  message: 'The parcel has moved on since you opened it. Refresh to see where it is now.',
  code: 'PARCEL_WRONG_STATUS',
};

export const PARCEL_PROOF_MISSING = {
  message: 'Add the recipient signature and the doorstep photo before confirming the delivery.',
  code: 'PARCEL_PROOF_MISSING',
};
export const PARCEL_PROOF_TYPE = {
  message: 'The signature and the doorstep photo must be JPEG, PNG or WebP images.',
  code: 'PARCEL_PROOF_TYPE',
};
export const PARCEL_PROOF_KIND = { message: 'There is no such proof of delivery.', code: 'PARCEL_PROOF_KIND' };
