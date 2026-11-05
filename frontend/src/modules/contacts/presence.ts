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
	queryClient.setQueryData<Contact[]>(contactsKey(), (contacts) =>
		contacts?.map((contact) => (contact.userId === userId ? { ...contact, status } : contact)),
	);
}
