import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@services/api-client';
import { tenantQueryKey } from '@utils/query-keys';
import { isForbidden, type ActivityInsights, type InsightsRange } from '../api';

// The company's activity counts for the last 7, 30 or 90 days. The key carries the company, so switching company
// never shows another company's numbers.
export function useInsights(range: InsightsRange) {
	return useQuery({
		queryKey: tenantQueryKey('insights', range),
		queryFn: () => apiRequest<ActivityInsights>(`activity-insights?range=${range}`),
		// The old range stays on screen while the new one loads.
		placeholderData: keepPreviousData,
		// Every read is audited, so don't reload just because the window got focus back.
		refetchOnWindowFocus: false,
		// A refusal won't change on retry.
		retry: (failures, error) => !isForbidden(error) && failures < 3,
	});
}
