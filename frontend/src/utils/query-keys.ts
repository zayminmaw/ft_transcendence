import { sessionStore } from '@app/store/session';

// Cached answers carry the user, and company data also the company, so one account or company never sees
// another's data. Build query keys with these instead of by hand.
export function tenantQueryKey(...parts: unknown[]) {
	const { userId, activeOrganizationId } = sessionStore.getSnapshot();
	return ['tenant', userId, activeOrganizationId, ...parts] as const;
}

export function platformQueryKey(...parts: unknown[]) {
	return ['platform', sessionStore.getSnapshot().userId, ...parts] as const;
}

// Every tenant answer on the platform pages sits under this key, so one invalidation refreshes the list and the
// details.
export function tenantsQueryKey() {
	return platformQueryKey('tenants');
}
