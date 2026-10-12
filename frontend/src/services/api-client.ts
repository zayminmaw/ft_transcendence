import { sessionStore } from '@app/store/session';
import { queryClient } from '@app/store/query-client';

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
	}
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
	const session = sessionStore.getSnapshot();
	const headers = new Headers(options.headers);
	if (options.body && !(options.body instanceof FormData))
		headers.set('Content-Type', 'application/json');
	if (session.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
	if (session.activeOrganizationId)
		headers.set('X-Organization-Id', session.activeOrganizationId);
	const response = await fetch(
		`${import.meta.env.VITE_API_BASE_URL || '/api'}/${path.replace(/^\//, '')}`,
		{ ...options, headers },
	);
	if (!response.ok) {
		const body: { message?: string | string[] } = await response.json().catch(() => ({}));
		if (response.status === 401) {
			sessionStore.clear();
			queryClient.clear();
		}
		throw new ApiError(
			response.status,
			Array.isArray(body.message)
				? body.message.join(', ')
				: body.message || 'The request could not be completed.',
		);
	}
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
}
