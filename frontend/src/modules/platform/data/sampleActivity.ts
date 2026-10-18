export type TenantActivity = {
	id: string;
	time: string;
	tenantId: string;
	tenant: string;
	action: string;
	actor: string;
	outcome: 'success' | 'failed';
	summary: string;
};

// Sample data until the tenant activity endpoint exists. Mirrors `audit_logs`; `outcome` has no
// column yet and needs a migration or convention.
export const tenantActivity: TenantActivity[] = [
	{
		id: '5',
		time: '17 Oct 2026, 09:42',
		tenantId: '5',
		tenant: 'Parcel Works',
		action: 'Administrator assigned',
		actor: 'Sami Odeh',
		outcome: 'failed',
		summary: 'Username already belongs to another account.',
	},
	{
		id: '4',
		time: '16 Oct 2026, 16:03',
		tenantId: '4',
		tenant: 'Atlas Dispatch',
		action: 'Tenant suspended',
		actor: 'Maya Fares',
		outcome: 'success',
		summary: 'Portal and API access suspended. Records retained.',
	},
	{
		id: '3',
		time: '15 Oct 2026, 14:50',
		tenantId: '1',
		tenant: 'Meridian Courier',
		action: 'Administrator assigned',
		actor: 'Sami Odeh',
		outcome: 'success',
		summary: 'Existing member promoted to tenant administrator.',
	},
	{
		id: '2',
		time: '14 Oct 2026, 15:31',
		tenantId: '2',
		tenant: 'Northline Logistics',
		action: 'Details updated',
		actor: 'Sami Odeh',
		outcome: 'success',
		summary: 'Organization address and contact email changed.',
	},
	{
		id: '1',
		time: '14 Oct 2026, 09:05',
		tenantId: '1',
		tenant: 'Meridian Courier',
		action: 'Tenant created',
		actor: 'Sami Odeh',
		outcome: 'success',
		summary: 'Tenant created with first administrator lina.haddad.',
	},
];
