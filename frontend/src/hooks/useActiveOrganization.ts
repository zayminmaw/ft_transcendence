import { queryClient } from '@app/store/query-client';
import { sessionStore } from '@app/store/session';
import { useAuth } from './useAuth';

// Drops every cached answer except the account's own (`['auth', ...]`), so nothing from the old company stays.
const companyData = {
	predicate: ({ queryKey }: { queryKey: readonly unknown[] }) => queryKey[0] !== 'auth',
};

export async function setActiveOrganization(organizationId: string | null) {
	await queryClient.cancelQueries(companyData);
	queryClient.removeQueries(companyData);
	sessionStore.setSession({
		...sessionStore.getSnapshot(),
		activeOrganizationId: organizationId,
	});
}

export function useActiveOrganization() {
	return { activeOrganizationId: useAuth().activeOrganizationId, setActiveOrganization };
}
