import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CompanyExportRepository } from './company-export.repository';
import type {
  CompanyExportFile,
  CompanyExportSnapshot,
  ExportAsset,
  ExportClient,
  ExportDriver,
  ExportFormat,
  ExportInvoice,
  ExportMember,
  ExportOrganization,
  ExportParcel,
  ExportSection,
} from './company-export.types';
import { type CsvSectionBlock, serializeCsvSections, serializeCsvTable } from './csv';

export const EXPORT_NOW = Symbol('EXPORT_NOW');

const ORGANIZATION_COLUMNS: readonly (keyof ExportOrganization & string)[] = [
  'id', 'name', 'slug', 'contactEmail', 'contactPhone', 'address', 'isActive', 'createdAt',
];

const MEMBER_COLUMNS: readonly (keyof ExportMember & string)[] = [
  'userId', 'username', 'email', 'displayName', 'roleCode', 'roleName', 'isActive', 'lastLoginAt',
];

const CLIENT_COLUMNS: readonly (keyof ExportClient & string)[] = [
  'id', 'clientCode', 'businessName', 'tradeLicenseNo', 'contactPersonName', 'contactTitle',
  'mobile1', 'mobile2', 'email', 'billingAddress', 'defaultPickupAddress', 'rateProfileTier',
  'currentBalance', 'pendingCodBalance', 'isActive', 'createdAt',
];

const DRIVER_COLUMNS: readonly (keyof ExportDriver & string)[] = [
  'employeeId', 'employeeCode', 'firstName', 'lastName', 'employmentStatus', 'hireDate',
  'driverCategory', 'fleetArrangement', 'assignedZone', 'dispatchStatus',
  'maxWeightCapacityKg', 'maxVolumeCapacityM3', 'licenseNumber', 'licenseClass',
  'licenseExpiryDate', 'backgroundCheckPassed', 'backgroundCheckDate',
  'transitInsurancePolicy', 'transitInsuranceExpiry',
];

const ASSET_COLUMNS: readonly (keyof ExportAsset & string)[] = [
  'id', 'assetTag', 'assetName', 'category', 'licensePlate', 'vin',
  'insurancePolicyNumber', 'roadTaxExpiry', 'currentCondition',
  'acquisitionCost', 'currentBookValue', 'createdAt',
];

const PARCEL_COLUMNS: readonly (keyof ExportParcel & string)[] = [
  'id', 'trackingNumber', 'status', 'clientCode', 'clientName', 'recipientName',
  'recipientPhone', 'deliveryCityZone', 'weightKg', 'isFragile', 'deliveryFee',
  'codAmount', 'collectedAmount', 'deliveryAttemptCount', 'deliveredAt', 'createdAt',
];

const INVOICE_COLUMNS: readonly (keyof ExportInvoice & string)[] = [
  'id', 'invoiceNumber', 'clientCode', 'clientName', 'status',
  'billingPeriodStart', 'billingPeriodEnd', 'issueDate', 'dueDate',
  'totalDeliveries', 'totalDeliveryFees', 'totalCodCollected', 'netAmountDue', 'createdAt',
];

function safeFilenameSlug(slug: string): string {
  const cleaned = slug.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'company';
}

// Explicit field-by-field projections prevent any unexpected repository property from leaking into exported files.
function sanitizeOrganization(row: ExportOrganization): ExportOrganization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    address: row.address,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

function sanitizeMember(row: ExportMember): ExportMember {
  return {
    userId: row.userId,
    username: row.username,
    email: row.email,
    displayName: row.displayName,
    roleCode: row.roleCode,
    roleName: row.roleName,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt,
  };
}

function sanitizeClient(row: ExportClient): ExportClient {
  return {
    id: row.id,
    clientCode: row.clientCode,
    businessName: row.businessName,
    tradeLicenseNo: row.tradeLicenseNo,
    contactPersonName: row.contactPersonName,
    contactTitle: row.contactTitle,
    mobile1: row.mobile1,
    mobile2: row.mobile2,
    email: row.email,
    billingAddress: row.billingAddress,
    defaultPickupAddress: row.defaultPickupAddress,
    rateProfileTier: row.rateProfileTier,
    currentBalance: row.currentBalance,
    pendingCodBalance: row.pendingCodBalance,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

function sanitizeDriver(row: ExportDriver): ExportDriver {
  return {
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    firstName: row.firstName,
    lastName: row.lastName,
    employmentStatus: row.employmentStatus,
    hireDate: row.hireDate,
    driverCategory: row.driverCategory,
    fleetArrangement: row.fleetArrangement,
    assignedZone: row.assignedZone,
    dispatchStatus: row.dispatchStatus,
    maxWeightCapacityKg: row.maxWeightCapacityKg,
    maxVolumeCapacityM3: row.maxVolumeCapacityM3,
    licenseNumber: row.licenseNumber,
    licenseClass: row.licenseClass,
    licenseExpiryDate: row.licenseExpiryDate,
    backgroundCheckPassed: row.backgroundCheckPassed,
    backgroundCheckDate: row.backgroundCheckDate,
    transitInsurancePolicy: row.transitInsurancePolicy,
    transitInsuranceExpiry: row.transitInsuranceExpiry,
  };
}

function sanitizeAsset(row: ExportAsset): ExportAsset {
  return {
    id: row.id,
    assetTag: row.assetTag,
    assetName: row.assetName,
    category: row.category,
    licensePlate: row.licensePlate,
    vin: row.vin,
    insurancePolicyNumber: row.insurancePolicyNumber,
    roadTaxExpiry: row.roadTaxExpiry,
    currentCondition: row.currentCondition,
    acquisitionCost: row.acquisitionCost,
    currentBookValue: row.currentBookValue,
    createdAt: row.createdAt,
  };
}

function sanitizeParcel(row: ExportParcel): ExportParcel {
  return {
    id: row.id,
    trackingNumber: row.trackingNumber,
    status: row.status,
    clientCode: row.clientCode,
    clientName: row.clientName,
    recipientName: row.recipientName,
    recipientPhone: row.recipientPhone,
    deliveryCityZone: row.deliveryCityZone,
    weightKg: row.weightKg,
    isFragile: row.isFragile,
    deliveryFee: row.deliveryFee,
    codAmount: row.codAmount,
    collectedAmount: row.collectedAmount,
    deliveryAttemptCount: row.deliveryAttemptCount,
    deliveredAt: row.deliveredAt,
    createdAt: row.createdAt,
  };
}

function sanitizeInvoice(row: ExportInvoice): ExportInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    clientCode: row.clientCode,
    clientName: row.clientName,
    status: row.status,
    billingPeriodStart: row.billingPeriodStart,
    billingPeriodEnd: row.billingPeriodEnd,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    totalDeliveries: row.totalDeliveries,
    totalDeliveryFees: row.totalDeliveryFees,
    totalCodCollected: row.totalCodCollected,
    netAmountDue: row.netAmountDue,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class CompanyExportService {
  constructor(
    private readonly repository: CompanyExportRepository,
    @Optional() @Inject(EXPORT_NOW) private readonly now: () => Date = () => new Date(),
  ) {}

  async generate(
    organizationId: string,
    format: ExportFormat,
    section: ExportSection,
  ): Promise<CompanyExportFile> {
    const rawOrganization = await this.repository.findOrganization(organizationId);
    if (!rawOrganization) throw new NotFoundException('Organization not found.');

    const organization = sanitizeOrganization(rawOrganization);
    const timestamp = this.now();
    const dateStamp = timestamp.toISOString().slice(0, 10);
    const slug = safeFilenameSlug(organization.slug);

    if (format === 'json') {
      const snapshot = await this.buildSnapshot(organizationId, organization, timestamp);
      return {
        filename: `${slug}-export-${dateStamp}.json`,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(snapshot, null, 2),
      };
    }

    const csvBody = await this.buildCsv(organizationId, organization, section);
    return {
      filename: `${slug}-${section}-${dateStamp}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: csvBody,
    };
  }

  private async buildSnapshot(
    organizationId: string,
    organization: ExportOrganization,
    timestamp: Date,
  ): Promise<CompanyExportSnapshot> {
    const [rawMembers, rawClients, rawDrivers, rawAssets, rawParcels, rawInvoices] = await Promise.all([
      this.repository.listMembers(organizationId),
      this.repository.listClients(organizationId),
      this.repository.listDrivers(organizationId),
      this.repository.listAssets(organizationId),
      this.repository.listParcels(organizationId),
      this.repository.listInvoices(organizationId),
    ]);

    const members = rawMembers.map(sanitizeMember);
    const clients = rawClients.map(sanitizeClient);
    const drivers = rawDrivers.map(sanitizeDriver);
    const assets = rawAssets.map(sanitizeAsset);
    const parcels = rawParcels.map(sanitizeParcel);
    const invoices = rawInvoices.map(sanitizeInvoice);

    return {
      exportedAt: timestamp.toISOString(),
      organization,
      counts: {
        members: members.length,
        clients: clients.length,
        drivers: drivers.length,
        assets: assets.length,
        parcels: parcels.length,
        invoices: invoices.length,
      },
      members,
      clients,
      drivers,
      assets,
      parcels,
      invoices,
    };
  }

  private async buildCsv(
    organizationId: string,
    organization: ExportOrganization,
    section: ExportSection,
  ): Promise<string> {
    switch (section) {
      case 'members':
        return serializeCsvTable(MEMBER_COLUMNS, (await this.repository.listMembers(organizationId)).map(sanitizeMember));
      case 'clients':
        return serializeCsvTable(CLIENT_COLUMNS, (await this.repository.listClients(organizationId)).map(sanitizeClient));
      case 'drivers':
        return serializeCsvTable(DRIVER_COLUMNS, (await this.repository.listDrivers(organizationId)).map(sanitizeDriver));
      case 'assets':
        return serializeCsvTable(ASSET_COLUMNS, (await this.repository.listAssets(organizationId)).map(sanitizeAsset));
      case 'parcels':
        return serializeCsvTable(PARCEL_COLUMNS, (await this.repository.listParcels(organizationId)).map(sanitizeParcel));
      case 'invoices':
        return serializeCsvTable(INVOICE_COLUMNS, (await this.repository.listInvoices(organizationId)).map(sanitizeInvoice));
      case 'all': {
        const [members, clients, drivers, assets, parcels, invoices] = await Promise.all([
          this.repository.listMembers(organizationId).then((rows) => rows.map(sanitizeMember)),
          this.repository.listClients(organizationId).then((rows) => rows.map(sanitizeClient)),
          this.repository.listDrivers(organizationId).then((rows) => rows.map(sanitizeDriver)),
          this.repository.listAssets(organizationId).then((rows) => rows.map(sanitizeAsset)),
          this.repository.listParcels(organizationId).then((rows) => rows.map(sanitizeParcel)),
          this.repository.listInvoices(organizationId).then((rows) => rows.map(sanitizeInvoice)),
        ]);
        const sections: CsvSectionBlock[] = [
          { name: 'organization', columns: ORGANIZATION_COLUMNS, rows: [organization] as unknown as Record<string, string | number | boolean | null>[] },
          { name: 'members', columns: MEMBER_COLUMNS, rows: members as unknown as Record<string, string | number | boolean | null>[] },
          { name: 'clients', columns: CLIENT_COLUMNS, rows: clients as unknown as Record<string, string | number | boolean | null>[] },
          { name: 'drivers', columns: DRIVER_COLUMNS, rows: drivers as unknown as Record<string, string | number | boolean | null>[] },
          { name: 'assets', columns: ASSET_COLUMNS, rows: assets as unknown as Record<string, string | number | boolean | null>[] },
          { name: 'parcels', columns: PARCEL_COLUMNS, rows: parcels as unknown as Record<string, string | number | boolean | null>[] },
          { name: 'invoices', columns: INVOICE_COLUMNS, rows: invoices as unknown as Record<string, string | number | boolean | null>[] },
        ];
        return serializeCsvSections(sections);
      }
    }
  }
}
