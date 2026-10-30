import { useQuery } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import { sampleDriversApi } from '../data/sampleDrivers';

// The company's driver-role accounts not linked to a driver yet, for the "Link account" choice. Under the drivers
// key, so linking and unlinking refresh it.
export function useLinkableAccounts(enabled: boolean) {
	const { data, isPending, isError } = useQuery({
		queryKey: tenantQueryKey('drivers', 'linkable-accounts'),
		// GET /api/drivers/linkable-accounts once the API exists.
		queryFn: () => sampleDriversApi.linkableAccounts(),
		enabled,
	});
	return { accounts: data ?? [], isAccountsPending: isPending, isAccountsError: isError };
}
