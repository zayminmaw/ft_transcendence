import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  ExportAsset,
  ExportClient,
  ExportDriver,
  ExportInvoice,
  ExportMember,
  ExportOrganization,
  ExportParcel,
} from './company-export.types';

type RawRow = Record<string, unknown>;

const toIso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();

const toIsoOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : toIso(value);

const toStringOrNull = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

const toBool = (value: unknown): boolean => Boolean(Number(value));

// Strictly tenant-scoped read queries for company-wide data export. Every single query filters by organizationId and
// uses an explicit allowlisted SELECT list so password hashes, refresh token hashes, invite token hashes, and
// unrelated tenant rows are never read.
@Injectable()
export class CompanyExportRepository {
  constructor(private readonly database: DataSource) {}

  async findOrganization(organizationId: string): Promise<ExportOrganization | null> {
    const [row]: RawRow[] = await this.database.query(
      `SELECT id, name, slug, contact_email AS contactEmail, contact_phone AS contactPhone,
              address, is_active AS isActive, created_at AS createdAt
         FROM organizations
        WHERE id = ?
        LIMIT 1`,
      [organizationId],
    );
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      contactEmail: String(row.contactEmail),
      contactPhone: toStringOrNull(row.contactPhone),
      address: toStringOrNull(row.address),
      isActive: toBool(row.isActive),
      createdAt: toIso(row.createdAt),
    };
  }

  async listMembers(organizationId: string): Promise<ExportMember[]> {
    const rows: RawRow[] = await this.database.query(
      `SELECT u.id AS userId, u.username, u.email, u.display_name AS displayName,
              r.code AS roleCode, r.name AS roleName, m.is_active AS isActive,
              u.last_login_at AS lastLoginAt
         FROM organization_members m
         JOIN users u ON u.id = m.user_id
         JOIN roles r ON r.id = m.role_id
        WHERE m.organization_id = ?
        ORDER BY u.username ASC, u.id ASC`,
      [organizationId],
    );
    return rows.map((row) => ({
      userId: String(row.userId),
      username: String(row.username),
      email: String(row.email),
      displayName: toStringOrNull(row.displayName),
      roleCode: String(row.roleCode),
      roleName: String(row.roleName),
      isActive: toBool(row.isActive),
      lastLoginAt: toIsoOrNull(row.lastLoginAt),
    }));
  }

  async listClients(organizationId: string): Promise<ExportClient[]> {
    const rows: RawRow[] = await this.database.query(
      `SELECT id, client_code AS clientCode, business_name AS businessName,
              trade_license_no AS tradeLicenseNo, contact_person_name AS contactPersonName,
              contact_title AS contactTitle, mobile_1 AS mobile1, mobile_2 AS mobile2,
              email, billing_address AS billingAddress, default_pickup_address AS defaultPickupAddress,
              rate_profile_tier AS rateProfileTier, current_balance AS currentBalance,
              pending_cod_balance AS pendingCodBalance, is_active AS isActive, created_at AS createdAt
         FROM clients
        WHERE organization_id = ?
        ORDER BY client_code ASC, id ASC`,
      [organizationId],
    );
    return rows.map((row) => ({
      id: String(row.id),
      clientCode: String(row.clientCode),
      businessName: String(row.businessName),
      tradeLicenseNo: toStringOrNull(row.tradeLicenseNo),
      contactPersonName: String(row.contactPersonName),
      contactTitle: toStringOrNull(row.contactTitle),
      mobile1: String(row.mobile1),
      mobile2: toStringOrNull(row.mobile2),
      email: String(row.email),
      billingAddress: String(row.billingAddress),
      defaultPickupAddress: String(row.defaultPickupAddress),
      rateProfileTier: String(row.rateProfileTier),
      currentBalance: String(row.currentBalance),
      pendingCodBalance: String(row.pendingCodBalance),
      isActive: toBool(row.isActive),
      createdAt: toIso(row.createdAt),
    }));
  }

  async listDrivers(organizationId: string): Promise<ExportDriver[]> {
    const rows: RawRow[] = await this.database.query(
      `SELECT e.id AS employeeId, e.employee_code AS employeeCode,
              e.first_name AS firstName, e.last_name AS lastName,
              e.employment_status AS employmentStatus, e.hire_date AS hireDate,
              d.driver_category AS driverCategory, d.fleet_arrangement AS fleetArrangement,
              d.assigned_zone AS assignedZone, d.dispatch_status AS dispatchStatus,
              d.max_weight_capacity_kg AS maxWeightCapacityKg, d.max_volume_capacity_m3 AS maxVolumeCapacityM3,
              d.license_number AS licenseNumber, d.license_class AS licenseClass,
              d.license_expiry_date AS licenseExpiryDate, d.background_check_passed AS backgroundCheckPassed,
              d.background_check_date AS backgroundCheckDate,
              d.transit_insurance_policy AS transitInsurancePolicy,
              d.transit_insurance_expiry AS transitInsuranceExpiry
         FROM employees e
         JOIN delivery_drivers d ON d.employee_id = e.id AND d.organization_id = e.organization_id
        WHERE e.organization_id = ? AND e.personnel_type = 'driver'
        ORDER BY e.employee_code ASC, e.id ASC`,
      [organizationId],
    );
    return rows.map((row) => ({
      employeeId: String(row.employeeId),
      employeeCode: String(row.employeeCode),
      firstName: String(row.firstName),
      lastName: String(row.lastName),
      employmentStatus: String(row.employmentStatus),
      hireDate: String(row.hireDate),
      driverCategory: String(row.driverCategory),
      fleetArrangement: String(row.fleetArrangement),
      assignedZone: toStringOrNull(row.assignedZone),
      dispatchStatus: String(row.dispatchStatus),
      maxWeightCapacityKg: String(row.maxWeightCapacityKg),
      maxVolumeCapacityM3: String(row.maxVolumeCapacityM3),
      licenseNumber: String(row.licenseNumber),
      licenseClass: String(row.licenseClass),
      licenseExpiryDate: String(row.licenseExpiryDate),
      backgroundCheckPassed: toBool(row.backgroundCheckPassed),
      backgroundCheckDate: toStringOrNull(row.backgroundCheckDate),
      transitInsurancePolicy: toStringOrNull(row.transitInsurancePolicy),
      transitInsuranceExpiry: toStringOrNull(row.transitInsuranceExpiry),
    }));
  }

  async listAssets(organizationId: string): Promise<ExportAsset[]> {
    const rows: RawRow[] = await this.database.query(
      `SELECT id, asset_tag AS assetTag, asset_name AS assetName, category,
              license_plate AS licensePlate, vin, insurance_policy_number AS insurancePolicyNumber,
              road_tax_expiry AS roadTaxExpiry, current_condition AS currentCondition,
              acquisition_cost AS acquisitionCost, current_book_value AS currentBookValue,
              created_at AS createdAt
         FROM assets
        WHERE organization_id = ?
        ORDER BY asset_tag ASC, id ASC`,
      [organizationId],
    );
    return rows.map((row) => ({
      id: String(row.id),
      assetTag: String(row.assetTag),
      assetName: String(row.assetName),
      category: String(row.category),
      licensePlate: toStringOrNull(row.licensePlate),
      vin: toStringOrNull(row.vin),
      insurancePolicyNumber: toStringOrNull(row.insurancePolicyNumber),
      roadTaxExpiry: toStringOrNull(row.roadTaxExpiry),
      currentCondition: String(row.currentCondition),
      acquisitionCost: String(row.acquisitionCost),
      currentBookValue: String(row.currentBookValue),
      createdAt: toIso(row.createdAt),
    }));
  }

  async listParcels(organizationId: string): Promise<ExportParcel[]> {
    const rows: RawRow[] = await this.database.query(
      `SELECT p.id, p.tracking_number AS trackingNumber, p.lifecycle_status AS status,
              c.client_code AS clientCode, c.business_name AS clientName,
              p.recipient_name AS recipientName, p.recipient_phone AS recipientPhone,
              p.delivery_city_zone AS deliveryCityZone, p.weight_kg AS weightKg,
              p.is_fragile AS isFragile, p.delivery_fee AS deliveryFee,
              p.cod_amount AS codAmount, p.collected_amount AS collectedAmount,
              p.delivery_attempt_count AS deliveryAttemptCount,
              p.delivered_at AS deliveredAt, p.created_at AS createdAt
         FROM parcels p
         JOIN clients c ON c.id = p.client_id AND c.organization_id = p.organization_id
        WHERE p.organization_id = ?
        ORDER BY p.created_at DESC, p.id DESC`,
      [organizationId],
    );
    return rows.map((row) => ({
      id: String(row.id),
      trackingNumber: String(row.trackingNumber),
      status: String(row.status),
      clientCode: String(row.clientCode),
      clientName: String(row.clientName),
      recipientName: String(row.recipientName),
      recipientPhone: String(row.recipientPhone),
      deliveryCityZone: String(row.deliveryCityZone),
      weightKg: String(row.weightKg),
      isFragile: toBool(row.isFragile),
      deliveryFee: String(row.deliveryFee),
      codAmount: String(row.codAmount),
      collectedAmount: toStringOrNull(row.collectedAmount),
      deliveryAttemptCount: Number(row.deliveryAttemptCount),
      deliveredAt: toIsoOrNull(row.deliveredAt),
      createdAt: toIso(row.createdAt),
    }));
  }

  async listInvoices(organizationId: string): Promise<ExportInvoice[]> {
    const rows: RawRow[] = await this.database.query(
      `SELECT i.id, i.invoice_number AS invoiceNumber,
              c.client_code AS clientCode, c.business_name AS clientName,
              i.status, i.billing_period_start AS billingPeriodStart,
              i.billing_period_end AS billingPeriodEnd, i.issue_date AS issueDate,
              i.due_date AS dueDate, i.total_deliveries AS totalDeliveries,
              i.total_delivery_fees AS totalDeliveryFees,
              i.total_cod_collected AS totalCodCollected,
              i.net_amount_due AS netAmountDue, i.created_at AS createdAt
         FROM invoices i
         JOIN clients c ON c.id = i.client_id AND c.organization_id = i.organization_id
        WHERE i.organization_id = ?
        ORDER BY i.issue_date DESC, i.id DESC`,
      [organizationId],
    );
    return rows.map((row) => ({
      id: String(row.id),
      invoiceNumber: String(row.invoiceNumber),
      clientCode: String(row.clientCode),
      clientName: String(row.clientName),
      status: String(row.status),
      billingPeriodStart: String(row.billingPeriodStart),
      billingPeriodEnd: String(row.billingPeriodEnd),
      issueDate: String(row.issueDate),
      dueDate: String(row.dueDate),
      totalDeliveries: Number(row.totalDeliveries),
      totalDeliveryFees: String(row.totalDeliveryFees),
      totalCodCollected: String(row.totalCodCollected),
      netAmountDue: String(row.netAmountDue),
      createdAt: toIso(row.createdAt),
    }));
  }
}
