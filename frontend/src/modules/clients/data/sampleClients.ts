import { ApiError } from '@services/api-client';
import type { Client, ClientList, ClientListParams, ClientValues } from '../api';
import { DEFAULT_RATE_TIER } from '../constants';

// Sample merchants until /api/clients exists. Fields mirror the `clients` table; money and coordinates stay strings
// like the DECIMAL columns.
const sampleClients: Client[] = [
	{
		id: '1',
		clientCode: 'CL-0001',
		businessName: 'Paper & Co.',
		tradeLicenseNo: 'CR-448120',
		contactPersonName: 'Rana Haddad',
		contactTitle: 'Operations lead',
		mobile1: '+962 7 9555 0142',
		mobile2: null,
		email: 'billing@paperco.example.test',
		billingAddress: '14 Wasfi Al Tal Street, Amman',
		defaultPickupAddress: 'Warehouse 3, Sahab Industrial City, Amman',
		pickupLatitude: '31.87012400',
		pickupLongitude: '36.00521300',
		currentBalance: '1840.50',
		pendingCodBalance: '620.00',
		rateProfileTier: 'priority',
		operationalNotes: 'Pickups before 11:00. Fragile stationery sets ship in double boxes.',
		isActive: true,
		createdAt: '2026-03-04T09:12:00Z',
		updatedAt: '2026-10-21T13:40:00Z',
	},
	{
		id: '2',
		clientCode: 'CL-0002',
		businessName: 'Olive Branch Market',
		tradeLicenseNo: 'CR-219774',
		contactPersonName: 'Khaled Odeh',
		contactTitle: 'Owner',
		mobile1: '+962 7 8811 2040',
		mobile2: '+962 6 552 1180',
		email: 'accounts@olivebranch.example.test',
		billingAddress: '3 Rainbow Street, Jabal Amman',
		defaultPickupAddress: '3 Rainbow Street, Jabal Amman',
		pickupLatitude: '31.95218300',
		pickupLongitude: '35.92614700',
		currentBalance: '-215.00',
		pendingCodBalance: '0.00',
		rateProfileTier: 'standard',
		operationalNotes: null,
		isActive: true,
		createdAt: '2026-04-11T08:00:00Z',
		updatedAt: '2026-10-02T10:15:00Z',
	},
	{
		id: '3',
		clientCode: 'CL-0003',
		businessName: 'Nomad Electronics',
		tradeLicenseNo: null,
		contactPersonName: 'Dina Shami',
		contactTitle: null,
		mobile1: '+962 7 7720 3301',
		mobile2: null,
		email: 'dina@nomad.example.test',
		billingAddress: 'Mecca Mall Offices, Floor 4, Amman',
		defaultPickupAddress: 'Mecca Mall loading bay B, Amman',
		pickupLatitude: null,
		pickupLongitude: null,
		currentBalance: '4210.75',
		pendingCodBalance: '1395.00',
		rateProfileTier: 'corporate',
		operationalNotes: 'High-value items: insured parcels only, signature required.',
		isActive: true,
		createdAt: '2026-05-19T11:30:00Z',
		updatedAt: '2026-10-25T16:05:00Z',
	},
	{
		id: '4',
		clientCode: 'CL-0004',
		businessName: 'Bloom Florists',
		tradeLicenseNo: 'CR-301552',
		contactPersonName: 'Sara Nasser',
		contactTitle: 'Manager',
		mobile1: '+962 7 9901 7788',
		mobile2: null,
		email: 'hello@bloom.example.test',
		billingAddress: '22 Abdoun Circle, Amman',
		defaultPickupAddress: '22 Abdoun Circle, Amman',
		pickupLatitude: '31.94580100',
		pickupLongitude: '35.88302500',
		currentBalance: '0.00',
		pendingCodBalance: '0.00',
		rateProfileTier: 'standard',
		operationalNotes: 'Same-day deliveries only.',
		isActive: false,
		createdAt: '2026-02-01T07:45:00Z',
		updatedAt: '2026-08-30T09:00:00Z',
	},
	{
		id: '5',
		clientCode: 'CL-0005',
		businessName: 'Atlas Sportswear',
		tradeLicenseNo: 'CR-512903',
		contactPersonName: 'Yousef Karam',
		contactTitle: 'E-commerce manager',
		mobile1: '+962 7 9640 1123',
		mobile2: '+962 7 9640 1124',
		email: 'ecom@atlas.example.test',
		billingAddress: 'King Abdullah II Street 88, Amman',
		defaultPickupAddress: 'Atlas fulfilment centre, Marka, Amman',
		pickupLatitude: '31.97690200',
		pickupLongitude: '35.98411000',
		currentBalance: '932.20',
		pendingCodBalance: '310.00',
		rateProfileTier: 'standard',
		operationalNotes: null,
		isActive: true,
		createdAt: '2026-06-23T12:00:00Z',
		updatedAt: '2026-10-28T08:20:00Z',
	},
];

// Stands in for the API: kept in memory (a reload starts over), answering with the API's shapes and refusals. Each
// answer is a copy, so the query cache never shares objects with it.
let clients = structuredClone(sampleClients);

function find(id: string) {
	const client = clients.find((item) => item.id === id);
	if (!client) throw new ApiError(404, 'Client not found.', 'CLIENT_NOT_FOUND');
	return client;
}

function checkCodeFree(code: string, exceptId?: string) {
	if (clients.some((item) => item.clientCode === code && item.id !== exceptId))
		throw new ApiError(409, 'This client code is already used.', 'CLIENT_CODE_TAKEN');
}

function save(client: Client) {
	clients = clients.some((item) => item.id === client.id)
		? clients.map((item) => (item.id === client.id ? client : item))
		: [...clients, client];
	return structuredClone(client);
}

export const sampleClientsApi = {
	async list(params: ClientListParams): Promise<ClientList> {
		const needle = params.search.trim().toLowerCase();
		const matching = clients.filter(
			(client) =>
				(params.status === 'all' || client.isActive === (params.status === 'active')) &&
				(!needle ||
					[
						client.businessName,
						client.clientCode,
						client.contactPersonName,
						client.mobile1,
					]
						.join(' ')
						.toLowerCase()
						.includes(needle)),
		);
		matching.sort((a, b) => {
			const order = a[params.sort].localeCompare(b[params.sort]);
			return params.direction === 'asc' ? order : -order;
		});
		const active = clients.filter((client) => client.isActive);
		return structuredClone({
			items: matching.slice(
				(params.page - 1) * params.pageSize,
				params.page * params.pageSize,
			),
			total: matching.length,
			page: params.page,
			pageSize: params.pageSize,
			counts: {
				total: clients.length,
				active: active.length,
				archived: clients.length - active.length,
				pinned: active.filter((client) => client.pickupLatitude && client.pickupLongitude)
					.length,
			},
		});
	},

	async get(id: string) {
		return structuredClone(find(id));
	},

	async create(values: ClientValues) {
		checkCodeFree(values.clientCode);
		const now = new Date().toISOString();
		return save({
			...values,
			id: String(Math.max(0, ...clients.map((item) => Number(item.id))) + 1),
			currentBalance: '0.00',
			pendingCodBalance: '0.00',
			rateProfileTier: values.rateProfileTier ?? DEFAULT_RATE_TIER,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		});
	},

	async update(id: string, values: ClientValues) {
		const current = find(id);
		checkCodeFree(values.clientCode, id);
		// Without clients.view_financials the form leaves the rate tier out; it keeps its value.
		const rateProfileTier = values.rateProfileTier ?? current.rateProfileTier;
		return save({
			...current,
			...values,
			rateProfileTier,
			updatedAt: new Date().toISOString(),
		});
	},

	// Archiving (clients.delete) keeps the record and its history; it only stops new parcels for the merchant.
	async setActive(id: string, isActive: boolean) {
		return save({ ...find(id), isActive, updatedAt: new Date().toISOString() });
	},
};
