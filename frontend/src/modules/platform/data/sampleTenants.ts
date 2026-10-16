export type Tenant = {
	id: string;
	organization: string;
	administrator: string;
	members: number;
	status: 'active' | 'suspended';
};

// Sample data until the tenant endpoints exist.
export const tenants: Tenant[] = [
	{
		id: '1',
		organization: 'Meridian Courier',
		administrator: 'Lina Haddad',
		members: 84,
		status: 'active',
	},
	{
		id: '2',
		organization: 'Northline Logistics',
		administrator: 'Omar Nasser',
		members: 52,
		status: 'active',
	},
	{
		id: '3',
		organization: 'Relay Express',
		administrator: 'Dana Saleh',
		members: 38,
		status: 'active',
	},
	{
		id: '4',
		organization: 'Atlas Dispatch',
		administrator: 'Karim Ali',
		members: 19,
		status: 'suspended',
	},
	{
		id: '5',
		organization: 'Parcel Works',
		administrator: 'Nour Khalil',
		members: 27,
		status: 'active',
	},
	{
		id: '6',
		organization: 'Urban Route',
		administrator: 'Rami Hasan',
		members: 16,
		status: 'suspended',
	},
	{
		id: '7',
		organization: 'Harbor Freight Co',
		administrator: 'Maya Farah',
		members: 61,
		status: 'active',
	},
	{
		id: '8',
		organization: 'Summit Haulage',
		administrator: 'Tariq Aziz',
		members: 44,
		status: 'active',
	},
	{
		id: '9',
		organization: 'Bluebird Delivery',
		administrator: 'Sara Mansour',
		members: 33,
		status: 'active',
	},
	{
		id: '10',
		organization: 'Cedar Line Cargo',
		administrator: 'Yousef Darwish',
		members: 12,
		status: 'active',
	},
	{
		id: '11',
		organization: 'Pioneer Post',
		administrator: 'Hala Younes',
		members: 29,
		status: 'active',
	},
	{
		id: '12',
		organization: 'Ironbridge Transport',
		administrator: 'Fadi Karam',
		members: 73,
		status: 'active',
	},
	{
		id: '13',
		organization: 'Lantern Logistics',
		administrator: 'Rana Sabbagh',
		members: 21,
		status: 'active',
	},
	{
		id: '14',
		organization: 'Quickstep Couriers',
		administrator: 'Samir Odeh',
		members: 9,
		status: 'suspended',
	},
	{
		id: '15',
		organization: 'Delta Parcel',
		administrator: 'Layla Nassar',
		members: 47,
		status: 'active',
	},
	{
		id: '16',
		organization: 'Greenway Dispatch',
		administrator: 'Bashar Hamdan',
		members: 35,
		status: 'active',
	},
	{
		id: '17',
		organization: 'Orbit Shipping',
		administrator: 'Dina Rahal',
		members: 58,
		status: 'active',
	},
	{
		id: '18',
		organization: 'Kestrel Express',
		administrator: 'Ziad Barakat',
		members: 24,
		status: 'active',
	},
	{
		id: '19',
		organization: 'Milestone Movers',
		administrator: 'Huda Saad',
		members: 18,
		status: 'active',
	},
	{
		id: '20',
		organization: 'Tidewater Freight',
		administrator: 'Nabil Shami',
		members: 66,
		status: 'active',
	},
	{
		id: '21',
		organization: 'Vector Courier',
		administrator: 'Rima Tannous',
		members: 31,
		status: 'active',
	},
	{
		id: '22',
		organization: 'Juniper Cargo',
		administrator: 'Adel Mourad',
		members: 14,
		status: 'active',
	},
	{
		id: '23',
		organization: 'Eastgate Delivery',
		administrator: 'Mona Habib',
		members: 40,
		status: 'active',
	},
	{
		id: '24',
		organization: 'Foxtrot Logistics',
		administrator: 'Walid Jaber',
		members: 26,
		status: 'active',
	},
];

export type TenantAdministrator = {
	name: string;
	username: string;
	origin: 'onboarding' | 'assigned';
};

export type TenantDetails = Tenant & {
	slug: string;
	contactEmail: string;
	phone: string | null;
	address: string | null;
	createdAt: string;
	activeMembers: number;
	administrators: TenantAdministrator[];
};

const toUsername = (name: string) => name.toLowerCase().replace(/\s+/g, '.');

// Fills in profile fields the list does not carry. Replaced by GET /platform/tenants/:id.
export function getTenantDetails(id: string): TenantDetails | null {
	const tenant = tenants.find((item) => item.id === id);
	if (!tenant) return null;
	const slug = tenant.organization.toLowerCase().replace(/\s+/g, '-');
	const administrators: TenantAdministrator[] = [
		{
			name: tenant.administrator,
			username: toUsername(tenant.administrator),
			origin: 'onboarding',
		},
	];
	if (id === '1') {
		administrators.push({ name: 'Nour Khalil', username: 'nour.khalil', origin: 'assigned' });
	}
	return {
		...tenant,
		slug,
		contactEmail: `office@${slug}.example.test`,
		phone: Number(id) % 3 === 0 ? null : `+962 7 9000 ${String(id).padStart(4, '0')}`,
		address: id === '1' ? '14 Al-Madina Street, Amman' : null,
		createdAt: '14 Oct 2026',
		activeMembers: Math.round(tenant.members * 0.9),
		administrators,
	};
}
