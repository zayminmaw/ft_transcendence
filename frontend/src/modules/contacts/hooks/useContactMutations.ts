import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import { addContact, removeContact } from '../api';

// Both lists change with every add or remove, and a refusal (already added, no longer allowed) means the page was out
// of date, so the lists reload after a failure too. The key is taken when the call starts, not when the answer comes:
// an answer that arrives after the person switched company or logged out reloads the company and account it was
// sent for, and never touches another one's cache (same idea as the profile save).
function useReloadContacts() {
	const queryClient = useQueryClient();
	return {
		onMutate: () => ({ queryKey: tenantQueryKey('contacts') }),
		onSettled: (
			_data: unknown,
			_error: unknown,
			_variables: unknown,
			context: { queryKey: readonly unknown[] } | undefined,
		) => {
			if (context) void queryClient.invalidateQueries({ queryKey: context.queryKey });
		},
	};
}

export function useAddContact() {
	return useMutation({ mutationFn: addContact, ...useReloadContacts() });
}

export function useRemoveContact() {
	return useMutation({ mutationFn: removeContact, ...useReloadContacts() });
}
