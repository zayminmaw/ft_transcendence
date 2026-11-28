export const EXPORT_FORMATS = ['json', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_SECTIONS = [
  'all',
  'members',
  'clients',
  'drivers',
  'assets',
  'parcels',
  'invoices',
] as const;
export type ExportSection = (typeof EXPORT_SECTIONS)[number];

export type SingleExportSection = Exclude<ExportSection, 'all'>;

export interface ExportOrganization {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ExportMember {
  userId: string;
  username: string;
  email: string;
  displayName: string | null;
  roleCode: string;
  roleName: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface ExportClient {
  id: string;
  clientCode: string;
  businessName: string;
  tradeLicenseNo: string | null;
  contactPersonName: string;
  contactTitle: string | null;
  mobile1: string;
  mobile2: string | null;
  email: string;
  billingAddress: string;
  defaultPickupAddress: string;
  rateProfileTier: string;
  currentBalance: string;
  pendingCodBalance: string;
  isActive: boolean;
  createdAt: string;
}

export interface ExportDriver {
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  employmentStatus: string;
  hireDate: string;
  driverCategory: string;
  fleetArrangement: string;
  assignedZone: string | null;
  dispatchStatus: string;
  maxWeightCapacityKg: string;
  maxVolumeCapacityM3: string;
  licenseNumber: string;
  licenseClass: string;
  licenseExpiryDate: string;
  backgroundCheckPassed: boolean;
  backgroundCheckDate: string | null;
  transitInsurancePolicy: string | null;
  transitInsuranceExpiry: string | null;
}

export interface ExportAsset {
  id: string;
  assetTag: string;
  assetName: string;
  category: string;
  licensePlate: string | null;
  vin: string | null;
  insurancePolicyNumber: string | null;
  roadTaxExpiry: string | null;
  currentCondition: string;
  acquisitionCost: string;
  currentBookValue: string;
  createdAt: string;
}

export interface ExportParcel {
  id: string;
  trackingNumber: string;
  status: string;
  clientCode: string;
  clientName: string;
  recipientName: string;
  recipientPhone: string;
  deliveryCityZone: string;
  weightKg: string;
  isFragile: boolean;
  deliveryFee: string;
  codAmount: string;
  collectedAmount: string | null;
  deliveryAttemptCount: number;
  deliveredAt: string | null;
  createdAt: string;
}

export interface ExportInvoice {
  id: string;
  invoiceNumber: string;
  clientCode: string;
  clientName: string;
  status: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  issueDate: string;
  dueDate: string;
  totalDeliveries: number;
  totalDeliveryFees: string;
  totalCodCollected: string;
  netAmountDue: string;
  createdAt: string;
}

export interface CompanyExportSnapshot {
  exportedAt: string;
  organization: ExportOrganization;
  counts: Record<SingleExportSection, number>;
  members: ExportMember[];
  clients: ExportClient[];
  drivers: ExportDriver[];
  assets: ExportAsset[];
  parcels: ExportParcel[];
  invoices: ExportInvoice[];
}

export interface CompanyExportFile {
  filename: string;
  contentType: string;
  body: string;
}
