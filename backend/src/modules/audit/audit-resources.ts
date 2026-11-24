import { isDeniedKey } from '../../common/logging/redaction';
import { FIELD_GROUPS } from '../drivers/constants';
import type { AuditCategory } from './audit.types';

// How a field is shown outside the company, i.e. to platform administrators. Values are stored as they are: a company
// sees all of its own data. plain: shown. maskEmail / maskPhone: shown masked (personal data). redact: only "it
// changed" is shown. A nested object of rules describes a nested value (e.g. the administrator inside a tenant change).
export type FieldRule = 'plain' | 'maskEmail' | 'maskPhone' | 'redact';
export interface FieldRules {
	[field: string]: FieldRule | FieldRules;
}

// Who in the company may read the stored values, as the resource's own module decides: `values` to see any of them,
// and a field listed in `fields` needs its own permission too. Other readers see only that a field changed.
export interface ReadPermissions {
	values: string;
	fields: Record<string, string>;
}

export interface AuditResource {
	category: AuditCategory;
	fields: FieldRules;
	// Who is told live about committed changes (notifications module); omit to tell no one.
	viewPermission?: string;
	// Omit when anyone with admin.audit_logs may read every value.
	readPermissions?: ReadPermissions;
}

// The allowlist. A field that is not listed is never stored, so a new column cannot leak into the trail by accident.
// Each module adds its resources here when it starts auditing, marking personal data (people's emails, phones,
// national ids, ...) so the platform never sees it.
export const AUDIT_RESOURCES: Record<string, AuditResource> = {
	// A person's own account: what they change on their profile.
	user: { category: 'security', fields: { displayName: 'plain', avatarFileId: 'plain' } },
	session: { category: 'security', fields: {} },
	member: {
		category: 'data',
		fields: { role: 'plain', isActive: 'plain' },
		viewPermission: 'admin.manage_users',
	},
	// One person saving another as a contact; no live notification.
	contact: { category: 'data', fields: { contactUserId: 'plain' } },
	tenant: {
		category: 'platform',
		fields: {
			name: 'plain',
			slug: 'plain',
			// The company's own contact details are business data the platform already manages.
			contactEmail: 'plain',
			contactPhone: 'plain',
			address: 'plain',
			isActive: 'plain',
			reason: 'plain',
			cause: 'plain',
			administrator: { id: 'plain', username: 'plain', email: 'maskEmail' },
		},
	},
	tenant_administrator: {
		category: 'platform',
		fields: {
			administrator: { id: 'plain', username: 'plain', email: 'maskEmail' },
			account: 'plain',
			role: 'plain',
			membershipActive: 'plain',
			reason: 'plain',
		},
	},
	// A merchant account. The contact's email and phones are personal data; notes are free text that may hold anything.
	// Balances are left out: they change only through billing's ledger entries.
	client: {
		category: 'data',
		fields: {
			clientCode: 'plain',
			businessName: 'plain',
			tradeLicenseNo: 'plain',
			contactPersonName: 'plain',
			contactTitle: 'plain',
			mobile1: 'maskPhone',
			mobile2: 'maskPhone',
			email: 'maskEmail',
			billingAddress: 'plain',
			defaultPickupAddress: 'plain',
			pickupLatitude: 'plain',
			pickupLongitude: 'plain',
			rateProfileTier: 'plain',
			operationalNotes: 'redact',
			isActive: 'plain',
		},
		viewPermission: 'clients.view',
	},
	// A waybill. The recipient's details are the company's own; the platform sees only that they changed.
	parcel: {
		category: 'data',
		fields: {
			trackingNumber: 'plain',
			status: 'plain',
			clientId: 'plain',
			recipientName: 'redact',
			recipientPhone: 'maskPhone',
			recipientSecondaryPhone: 'maskPhone',
			deliveryAddress: 'redact',
			deliveryCityZone: 'plain',
			deliveryLandmark: 'redact',
			weightKg: 'plain',
			isFragile: 'plain',
			deliveryFee: 'plain',
			codAmount: 'plain',
			driverId: 'plain',
			vehicleId: 'plain',
			runId: 'plain',
			deliveryAttemptCount: 'plain',
			failedReasonCode: 'plain',
		},
		viewPermission: 'parcels.view',
	},
	// A courier. Personal and payroll data are the company's own; the platform sees only that they changed.
	driver: {
		category: 'data',
		fields: {
			employeeCode: 'plain',
			firstName: 'plain',
			lastName: 'plain',
			personalMobile: 'maskPhone',
			personalEmail: 'maskEmail',
			nationalId: 'redact',
			dateOfBirth: 'redact',
			residentialAddress: 'redact',
			emergencyContactName: 'redact',
			emergencyContactPhone: 'maskPhone',
			employmentClassification: 'plain',
			compensationType: 'plain',
			employmentStatus: 'plain',
			hireDate: 'plain',
			terminationDate: 'plain',
			baseSalary: 'redact',
			bankName: 'redact',
			bankAccountIban: 'redact',
			driverCategory: 'plain',
			fleetArrangement: 'plain',
			assignedZone: 'plain',
			maxWeightCapacityKg: 'plain',
			maxVolumeCapacityM3: 'plain',
			commissionPerDrop: 'plain',
			licenseNumber: 'plain',
			licenseClass: 'plain',
			licenseExpiryDate: 'plain',
			// backgroundCheckPassed, renamed: "pass" reads as a secret to the redaction rules.
			backgroundCheck: 'plain',
			backgroundCheckDate: 'plain',
			transitInsurancePolicy: 'plain',
			transitInsuranceExpiry: 'plain',
			dispatchStatus: 'plain',
			account: { userId: 'plain', username: 'plain' },
		},
		viewPermission: 'drivers.view',
		readPermissions: { values: 'drivers.view', fields: driverFieldPermissions() },
	},
	// A vehicle or piece of equipment, who has it (check-out and check-in) and its services. Notes are free text that
	// may hold anything.
	asset: {
		category: 'data',
		fields: {
			assetTag: 'plain',
			assetName: 'plain',
			category: 'plain',
			acquisitionCost: 'plain',
			currentBookValue: 'plain',
			licensePlate: 'plain',
			vin: 'plain',
			insurancePolicyNumber: 'plain',
			roadTaxExpiry: 'plain',
			currentCondition: 'plain',
			notes: 'redact',
			holder: { driverId: 'plain', driverName: 'plain' },
			service: {
				serviceDate: 'plain',
				serviceType: 'plain',
				serviceCost: 'plain',
				vendorServiceCenter: 'plain',
				nextServiceDue: 'plain',
				notes: 'redact',
			},
		},
		viewPermission: 'assets.view',
	},
	// A wire to a merchant. The amounts are the company's own money figures.
	payout: {
		category: 'data',
		fields: { amount: 'plain', balanceAfter: 'plain' },
		viewPermission: 'billing.view',
	},
	// A statement of a merchant's delivery fees. The totals are the company's own money figures.
	invoice: {
		category: 'data',
		fields: { status: 'plain', totalDeliveries: 'plain', totalDeliveryFees: 'plain', netAmountDue: 'plain' },
		viewPermission: 'billing.view',
	},
	audit_log: { category: 'access', fields: {} },
	// Someone opened the activity insights page, or was refused. Only counts are shown there, so no fields are stored.
	activity_insight: { category: 'access', fields: {} },
};

// The Drivers API's field groups (personal, payroll, compliance, earnings) by the names the snapshot uses, so the audit
// log hides from a role exactly what that API hides.
function driverFieldPermissions(): Record<string, string> {
	const result: Record<string, string> = {};
	for (const { permission, fields } of Object.values(FIELD_GROUPS)) {
		for (const field of fields) result[field === 'backgroundCheckPassed' ? 'backgroundCheck' : field] = permission;
	}
	return result;
}

// Every permission some stored value needs, so a reader's are looked up once per request.
export const READ_PERMISSIONS = [...new Set(Object.values(AUDIT_RESOURCES).flatMap((resource) => resource.readPermissions
	? [resource.readPermissions.values, ...Object.values(resource.readPermissions.fields)]
	: []))];

export function auditResource(resourceType: string): AuditResource {
	const resource = AUDIT_RESOURCES[resourceType];
	if (!resource) throw new Error(`Unknown audit resource "${resourceType}": add it to AUDIT_RESOURCES.`);
	return resource;
}

// A denied key (password, token, …) can never be allowlisted, so a typo in this file fails at startup, not in production.
function assertNoDeniedFields(rules: FieldRules, path: string) {
	for (const [field, rule] of Object.entries(rules)) {
		if (isDeniedKey(field)) throw new Error(`Audit field "${path}${field}" can never be stored.`);
		if (typeof rule === 'object') assertNoDeniedFields(rule, `${path}${field}.`);
	}
}
// A restricted field must be one that is stored, so a renamed field can't slip out of its restriction unnoticed.
function assertReadableFieldsStored(resource: AuditResource, type: string) {
	for (const field of Object.keys(resource.readPermissions?.fields ?? {})) {
		if (!(field in resource.fields)) throw new Error(`Audit field "${type}.${field}" is restricted but not stored.`);
	}
}
for (const [type, resource] of Object.entries(AUDIT_RESOURCES)) {
	assertNoDeniedFields(resource.fields, `${type}.`);
	assertReadableFieldsStored(resource, type);
}
