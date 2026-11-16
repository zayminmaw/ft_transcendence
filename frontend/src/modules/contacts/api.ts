import { apiRequest } from '@services/api-client';

// /api/contacts: your own saved colleagues in the company that is open (the API client sends its X-Organization-Id).
// A suspended person stays in the list as "suspended"; online and offline come from a live connection to this company.
export type ContactStatus = 'online' | 'offline' | 'suspended';

export type Contact = {
	userId: string;
	username: string;
	// The name the person chose on their profile; null shows the username.
	displayName: string | null;
	role: { code: string; name: string };
	status: ContactStatus;
};

export function listContacts() {
	return apiRequest<Contact[]>('contacts');
}

// The people your role may still add: active, in this company, not you and not already saved.
export function listCandidates() {
	return apiRequest<Contact[]>('contacts/candidates');
}

// Refused with CONTACT_NOT_ELIGIBLE (403), CONTACT_SELF (400) or CONTACT_EXISTS (409).
export function addContact(userId: string) {
	return apiRequest<Contact>('contacts', { method: 'POST', body: JSON.stringify({ userId }) });
}

// CONTACT_NOT_FOUND (404) when that person is not in your contacts.
export function removeContact(userId: string) {
	return apiRequest<void>(`contacts/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}
