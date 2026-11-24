import { useQuery } from '@tanstack/react-query';
import { retryServerErrors } from '@services/api-client';
import { tenantQueryKey } from '@utils/query-keys';
import { listCandidates, listContacts } from '../api';

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
