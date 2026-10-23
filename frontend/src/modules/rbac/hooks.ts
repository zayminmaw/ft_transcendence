import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@services/api-client';
import { tenantQueryKey } from '@utils/query-keys';
import { listMembers } from './api';

// A refusal (403 without user management, 404) won't change on a second try; a network or server error might.
const retryServerErrors = (failures: number, error: unknown) =>
	failures < 1 && !(error instanceof ApiError && error.status < 500);

export function useMembers() {
	return useQuery({
		queryKey: tenantQueryKey('members'),
		queryFn: listMembers,
		retry: retryServerErrors,
	});
}
