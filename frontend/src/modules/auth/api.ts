import { apiRequest } from '@services/api-client';

export type AccountUser = {
	id: string;
	username: string;
	email: string;
	// The name the person chose on their profile; null shows the username (shownName).
	displayName: string | null;
	// A signed link to the person's picture, valid 10 to 15 minutes (/me hands out a fresh one); null shows initials.
	avatarUrl: string | null;
	createdAt: string;
};
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

// Your own display name: null (or an empty name) shows your username. Answers with your account as /me shows it.
export function updateProfile(displayName: string | null) {
	return apiRequest<{ user: AccountUser }>('auth/me', {
		method: 'PATCH',
		body: JSON.stringify({ displayName }),
	});
}

// Your picture: one JPEG, PNG or WebP of at most 2 MB, replacing the one before. Answers like updateProfile.
export function uploadAvatar(file: File) {
	const body = new FormData();
	body.append('file', file);
	return apiRequest<{ user: AccountUser }>('auth/me/avatar', { method: 'PUT', body });
}

// Back to your initials.
export function removeAvatar() {
	return apiRequest<{ user: AccountUser }>('auth/me/avatar', { method: 'DELETE' });
}
