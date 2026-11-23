import type { ParcelStatus, ProofKind } from '../constants';

// The people and things a parcel points to, as the screens name them.
export interface ParcelClient { id: string; code: string; name: string }
export interface ParcelDriver { id: string; name: string; employeeCode: string }
export interface ParcelVehicle { id: string; tag: string; name: string; licensePlate: string | null }
// RUN-<yyyymmdd>-<id>.
export interface ParcelRun { id: string; code: string }

// What the API answers for a parcel. Money and weight stay strings, like the DECIMAL columns.
export interface ParcelRecord {
  id: string;
  trackingNumber: string;
  status: ParcelStatus;
  client: ParcelClient;
  driver: ParcelDriver | null;
  vehicle: ParcelVehicle | null;
  run: ParcelRun | null;
  recipientName: string;
  recipientPhone: string;
  recipientSecondaryPhone: string | null;
  deliveryAddress: string;
  deliveryCityZone: string;
  deliveryLandmark: string | null;
  weightKg: string;
  isFragile: boolean;
  deliveryFee: string;
  codAmount: string;
  deliveryAttemptCount: number;
  failedReasonCode: string | null;
  // Set once the delivery is confirmed. The location is where the device was then, if it shared it.
  deliveredAt: Date | null;
  deliveryLocation: { latitude: string; longitude: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

// One step of the history. `actor` is who recorded it; null once their account is gone.
export interface ParcelEventRecord {
  id: string;
  status: ParcelStatus;
  at: Date;
  actor: { userId: string; name: string } | null;
  hubLocation: string | null;
  driver: ParcelDriver | null;
  vehicle: ParcelVehicle | null;
  run: ParcelRun | null;
  reasonCode: string | null;
  notes: string | null;
}

// One file of the proof of delivery. `url` is a signed link that opens it for 10 to 15 minutes.
export interface ProofFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export type ParcelProof = Record<ProofKind, ProofFile | null>;

// The proof's files are uploaded while the parcel is out for delivery and kept once it is delivered.
export interface ParcelDetails extends ParcelRecord {
  events: ParcelEventRecord[];
  proof: ParcelProof;
}

// What the confirmed delivery records besides its files.
export interface DeliveryValues {
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
}

// Over the whole company, whatever the search and filter: parcels per status, and the drivers out with parcels now.
export interface ParcelCounts {
  statuses: Record<ParcelStatus, number>;
  driversOut: number;
}

// A driver a parcel can go to now, with the vehicle they have checked out and today's run if it is open.
export interface DispatchDriver extends ParcelDriver {
  zone: string | null;
  category: string;
  dispatchStatus: string;
  vehicle: ParcelVehicle | null;
  run: (ParcelRun & { parcelsOut: number }) | null;
}

// What the new parcel form chooses from.
export interface ParcelFormOptions {
  clients: ParcelClient[];
  zones: string[];
}

// The columns a new parcel is written with.
export interface NewParcel {
  clientId: string;
  recipientName: string;
  recipientPhone: string;
  recipientSecondaryPhone: string | null;
  deliveryAddress: string;
  deliveryCityZone: string;
  deliveryLandmark: string | null;
  weightKg: string;
  isFragile: boolean;
  deliveryFee: string;
  codAmount: string;
}
