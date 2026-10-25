import { apiRequest } from '@services/api-client';

export type AccountUser = { id: string; username: string; email: string };
export type Workspace = {
	id: string;
	slug: string;
	name: string;
	// The person's role in that company, shown next to their name in the sidebar card.
	role: { code: string; name: string };
	// What that role allows there (the API's own rule), e.g. "parcels.view": what the interface may offer.
	permissions: string[];
};
export type Me = {
	user: AccountUser;
	workspaces: Workspace[];
	platformAccess: boolean;
	// Set when an admin gave or reset the password: the account must choose its own before anything else.
	mustChangePassword: boolean;
};
export type LoginValues = { login: string; password: string };
export type PasswordChange = { currentPassword: string; newPassword: string };

export function logIn(values: LoginValues) {
	return apiRequest<{ accessToken: string; user: AccountUser }>('auth/login', {
		method: 'POST',
		body: JSON.stringify(values),
	});
}

export function fetchMe() {
	return apiRequest<Me>('auth/me');
}

// Answers with a fresh access token without the must-change flag; the account's other sessions end.
export function changePassword(values: PasswordChange) {
	return apiRequest<{ accessToken: string }>('auth/password', {
		method: 'POST',
		body: JSON.stringify(values),
	});
}
