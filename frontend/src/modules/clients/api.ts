// /api/clients: the merchant accounts of the open company (X-Organization-Id). Refusals carry a code, e.g.
// CLIENT_CODE_TAKEN or CLIENT_NOT_FOUND.
export type ClientStatusFilter = 'active' | 'archived' | 'all';

export type ClientSortKey = 'businessName' | 'clientCode' | 'createdAt';

export type ClientListParams = {
	search: string;
	status: ClientStatusFilter;
	sort: ClientSortKey;
	direction: 'asc' | 'desc';
	page: number;
	pageSize: number;
};

export type Client = {
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
	pickupLatitude: string | null;
	pickupLongitude: string | null;
	// Only with clients.view_financials: the API leaves them out otherwise. Balances change only through
	// ledger entries (billing), never through this module.
	currentBalance?: string;
	pendingCodBalance?: string;
	rateProfileTier?: string;
	operationalNotes: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
};

export type ClientList = {
	items: Client[];
	total: number;
	page: number;
	pageSize: number;
	// Over the whole company, whatever the search and filter: `pinned` is active clients with pickup coordinates.
	counts: { total: number; active: number; archived: number; pinned: number };
};

export type ClientValues = Omit<
	Client,
	'id' | 'currentBalance' | 'pendingCodBalance' | 'isActive' | 'createdAt' | 'updatedAt'
>;
