import { apiRequest } from '@services/api-client';

export type AccountUser = { id: string; username: string; email: string };
export type Workspace = { id: string; slug: string; name: string };
export type Me = { user: AccountUser; workspaces: Workspace[]; platformAccess: boolean };
export type LoginValues = { login: string; password: string };

export function logIn(values: LoginValues) {
	return apiRequest<{ accessToken: string; user: AccountUser }>('auth/login', {
		method: 'POST',
		body: JSON.stringify(values),
	});
}

export function fetchMe() {
	return apiRequest<Me>('auth/me');
}
