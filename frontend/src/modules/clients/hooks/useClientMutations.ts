import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import type { ClientValues } from '../api';
import { sampleClientsApi } from '../data/sampleClients';

// Creating, editing, archiving and reactivating clients. Each change refreshes every client answer, so the list and
// the details never show stale data.
export function useClientMutations() {
	const queryClient = useQueryClient();
	const refreshClients = () =>
		queryClient.invalidateQueries({ queryKey: tenantQueryKey('clients') });

	// POST /api/clients
	const create = useMutation({
		mutationFn: (values: ClientValues) => sampleClientsApi.create(values),
		onSuccess: refreshClients,
	});
	// PATCH /api/clients/:id
	const update = useMutation({
		mutationFn: ({ clientId, values }: { clientId: string; values: ClientValues }) =>
			sampleClientsApi.update(clientId, values),
		onSuccess: refreshClients,
	});
	// POST /api/clients/:id/archive or /reactivate
	const setActive = useMutation({
		mutationFn: ({ clientId, active }: { clientId: string; active: boolean }) =>
			sampleClientsApi.setActive(clientId, active),
		// Also after a refusal: someone else may have changed the client first.
		onSettled: refreshClients,
	});

	return {
		createClient: create.mutate,
		isCreating: create.isPending,
		createError: create.error,
		updateClient: update.mutate,
		isUpdating: update.isPending,
		updateError: update.error,
		setClientActive: setActive.mutate,
		isSettingActive: setActive.isPending,
		setActiveError: setActive.error,
		resetSetActive: setActive.reset,
	};
}
