import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@services/api-client';
import { platformQueryKey } from '@utils/query-keys';
import type { PlatformSignins, SigninsRange } from '../api';

// The platform's sign-in counts for the last 7, 30 or 90 days. The key carries the signed-in account, so another
// account on the same browser never sees these numbers.
export function useSignins(range: SigninsRange) {
	return useQuery({
		queryKey: platformQueryKey('signins', range),
		queryFn: () => apiRequest<PlatformSignins>(`platform/signins?range=${range}`),
		// The old range stays on screen while the new one loads.
		placeholderData: keepPreviousData,
	});
}
