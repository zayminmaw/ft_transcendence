import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@services/api-client';
import { tenantQueryKey } from '@utils/query-keys';
import { listCandidates, listContacts } from '../api';

// A refusal (403, 404) won't change on a second try; a network or server error might.
const retryServerErrors = (failures: number, error: unknown) =>
	failures < 1 && !(error instanceof ApiError && error.status < 500);

// Both lists sit under tenantQueryKey('contacts'), so one invalidation refreshes them together.
export const contactsKey = () => tenantQueryKey('contacts', 'list');
export const candidatesKey = () => tenantQueryKey('contacts', 'candidates');

export function useContacts() {
	return useQuery({ queryKey: contactsKey(), queryFn: listContacts, retry: retryServerErrors });
}

export function useCandidates() {
	return useQuery({
		queryKey: candidatesKey(),
		queryFn: listCandidates,
		retry: retryServerErrors,
	});
}
