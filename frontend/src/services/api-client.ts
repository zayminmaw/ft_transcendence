import { sessionStore } from '@app/store/session';
import { API_BASE_URL, endSession, refreshSession } from './session-refresh';

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly code?: string,
	) {
		super(message);
	}
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
	// The retry reuses this company, so a request never moves to a company opened while it waited.
	const { accessToken, activeOrganizationId } = sessionStore.getSnapshot();
	let response = await send(path, options, accessToken, activeOrganizationId);
	if (response.status === 401 && accessToken) {
		const renewed = await renewAccessToken(accessToken);
		if (renewed) response = await send(path, options, renewed, activeOrganizationId);
		else if (sessionStore.getSnapshot().accessToken === accessToken) endSession('expired');
	}
	if (!response.ok) throw await toApiError(response);
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
}

// An expired access token gets one refresh. Requests that fail together share it, and a request that fails after
// another one refreshed just uses the new token. Two refreshes in the same second can return the same token, so
// the answer comes from the refresh, not from comparing tokens.
async function renewAccessToken(expired: string): Promise<string | null> {
	const current = sessionStore.getSnapshot().accessToken;
	if (current !== expired) return current;
	return (await refreshSession()) ? sessionStore.getSnapshot().accessToken : null;
}

function send(
	path: string,
	options: RequestInit,
	accessToken: string | null,
	organizationId: string | null,
) {
	const headers = new Headers(options.headers);
	if (options.body && !(options.body instanceof FormData))
		headers.set('Content-Type', 'application/json');
	if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
	if (organizationId) headers.set('X-Organization-Id', organizationId);
	return fetch(`${API_BASE_URL}/${path.replace(/^\//, '')}`, { ...options, headers });
}

async function toApiError(response: Response): Promise<ApiError> {
	const body: { message?: string | string[]; code?: string } = await response
		.json()
		.catch(() => ({}));
	const message = Array.isArray(body.message)
		? body.message.join(', ')
		: body.message || 'The request could not be completed.';
	return new ApiError(response.status, message, body.code);
}
