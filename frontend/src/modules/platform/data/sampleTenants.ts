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
];

// Sample tenant shown on the detail and administrator pages until the tenant endpoints exist.
export const sampleTenant = {
	id: '1',
	organization: 'Meridian Courier',
	slug: 'meridian-courier',
	contactEmail: 'office@meridian-courier.example.test',
	phone: '+962 7 9000 0001',
	address: '14 Al-Madina Street, Amman',
	createdAt: '14 Oct 2026',
	members: 84,
	activeMembers: 76,
	status: 'active' as Tenant['status'],
	administrators: [
		{
			name: 'Lina Haddad',
			username: 'lina.haddad',
			email: 'lina@meridian-courier.example.test',
			origin: 'Created during onboarding',
			addedAt: '14 Oct 2026',
		},
		{
			name: 'Nour Khalil',
			username: 'nour.khalil',
			email: 'nour@meridian-courier.example.test',
			origin: 'Assigned after onboarding',
			addedAt: '15 Oct 2026',
		},
	],
};

export const sampleMembers = [
	{ name: 'Rami Saleh', username: 'rami.saleh', role: 'Dispatcher' },
	{ name: 'Huda Amin', username: 'huda.amin', role: 'Finance' },
	{ name: 'Samer Kassab', username: 'samer.kassab', role: 'Hub operator' },
];
