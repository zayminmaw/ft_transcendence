import type { ASSET_FIELDS, ASSET_SORTS, AssetCondition, AssetStatusFilter } from '../constants';
import type { Asset } from '../entities/asset.entity';
import type { AssetMaintenanceLog } from '../entities/asset-maintenance-log.entity';

// What the asset form sets.
export type AssetValues = Pick<Asset, (typeof ASSET_FIELDS)[number]>;
// Left out (undefined) keeps the saved value.
export type AssetChanges = Partial<AssetValues>;

// The driver who has the asset: its check-out without a check-in.
export interface AssetHolder {
  assignmentId: string;
  driverId: string;
  driverName: string;
  checkedOutAt: Date;
  checkoutNotes: string | null;
}

// One asset as the API answers it in the list.
export type AssetRecord = AssetValues & Pick<Asset, 'id' | 'createdAt' | 'updatedAt'> & {
  holder: AssetHolder | null;
  // From the latest service that set one.
  nextServiceDue: string | null;
};

export interface AssetAssignmentRecord {
  id: string;
  driverId: string;
  driverName: string;
  checkedOutAt: Date;
  checkedInAt: Date | null;
  checkoutNotes: string | null;
  checkinNotes: string | null;
}

export type MaintenanceRecord = Omit<AssetMaintenanceLog, 'assetId'>;

// One asset with its check-outs and services, newest first.
export type AssetDetails = AssetRecord & {
  assignments: AssetAssignmentRecord[];
  maintenanceLogs: MaintenanceRecord[];
};

export interface AssetListQuery {
  search?: string;
  status: AssetStatusFilter;
  sort: (typeof ASSET_SORTS)[number];
  direction: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

// Over the whole company, whatever the search and filter. Decommissioned assets count only as decommissioned.
export interface AssetCounts {
  inService: number;
  checkedOut: number;
  needsMaintenance: number;
  decommissioned: number;
  roadTaxDue: number;
}

export interface CheckOut {
  driverId: string;
  notes: string | null;
}

export interface CheckIn {
  condition: AssetCondition;
  notes: string | null;
}

export type MaintenanceValues = Omit<MaintenanceRecord, 'id' | 'createdAt'> & { condition: AssetCondition };
