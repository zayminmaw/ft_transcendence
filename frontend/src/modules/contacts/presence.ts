import { queryClient } from '@app/store/query-client';
import { sessionStore } from '@app/store/session';
import type { PresencePayload } from '@hooks/useWebSocket';
import type { Contact } from './api';
import { contactsKey } from './hooks/useContacts';

// A contact's new status, from the server's `presence` event, put into the cached contacts list so the page changes
// without a reload. The one socket of the open company delivers it (see useLiveUpdates). An event for another company
// is dropped, and nothing is created when the list was never loaded; the next load carries the status itself.
export function applyPresence({ organizationId, userId, status }: PresencePayload) {
	if (organizationId !== sessionStore.getSnapshot().activeOrganizationId) return;
	const key = contactsKey();
	const state = queryClient.getQueryState<Contact[]>(key);
	if (!state?.data) return;
	// A list already marked out of date (we reconnected) or being fetched right now would be made to look fresh by a
	// patch, and the missed changes would stay. Fetch it again instead.
	if (state.isInvalidated || state.fetchStatus === 'fetching') {
		void queryClient.invalidateQueries({ queryKey: key });
		return;
	}
	queryClient.setQueryData<Contact[]>(
		key,
		(contacts) =>
			contacts?.map((contact) =>
				contact.userId === userId ? { ...contact, status } : contact,
			),
		{ updatedAt: state.dataUpdatedAt },
	);
}
