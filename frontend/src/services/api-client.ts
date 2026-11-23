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

// The API's code for a refusal, e.g. CLIENT_CODE_TAKEN; undefined for anything else.
export function errorCode(error: unknown) {
	return error instanceof ApiError ? error.code : undefined;
}

// What a code → value map gives a refusal, e.g. the form field it belongs to; undefined when its code isn't there.
export function fromErrorCode<T>(map: Record<string, T>, error: unknown): T | undefined {
	const code = errorCode(error);
	return code !== undefined && Object.hasOwn(map, code) ? map[code] : undefined;
}

// A refusal as a translation key: its own message when the map knows its code, the general one otherwise.
export function errorKey<K extends string>(map: Record<string, K>, error: unknown) {
	return fromErrorCode(map, error) ?? 'errors.unknown';
}

// fetch's options, plus how far an upload is (0 to 1). fetch can't tell how much of a body has been sent, so a request
// with onUploadProgress goes through XMLHttpRequest instead; everything else about it is the same.
export type ApiRequestOptions = RequestInit & { onUploadProgress?: (fraction: number) => void };

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
	// The retry reuses this company, so a request never moves to a company opened while it waited.
	const { accessToken, activeOrganizationId } = sessionStore.getSnapshot();
	let response = await send(path, options, accessToken, activeOrganizationId);
	if (response.status === 401 && accessToken) {
		const renewal = await renewAccessToken(accessToken);
		if ('token' in renewal)
			response = await send(path, options, renewal.token, activeOrganizationId);
		else if (
			renewal.failure === 'ended' &&
			sessionStore.getSnapshot().accessToken === accessToken
		)
			endSession('expired');
	}
	if (!response.ok) throw await toApiError(response);
	if (response.status === 204) return undefined as T;
	return response.json() as Promise<T>;
}

type Renewal = { token: string } | { failure: 'ended' | 'unavailable' };

// An expired access token gets one refresh. Requests that fail together share it, and a request that fails after
// another one refreshed just uses the new token. Two refreshes in the same second can return the same token, so
// the answer comes from the refresh, not from comparing tokens. 'unavailable' keeps the session: the request fails,
// and the next one tries again.
async function renewAccessToken(expired: string): Promise<Renewal> {
	const current = sessionStore.getSnapshot().accessToken;
	if (current !== expired) return current ? { token: current } : { failure: 'ended' };
	const result = await refreshSession();
	if (result !== 'ok') return { failure: result };
	const renewed = sessionStore.getSnapshot().accessToken;
	return renewed ? { token: renewed } : { failure: 'ended' };
}

function send(
	path: string,
	{ onUploadProgress, ...options }: ApiRequestOptions,
	accessToken: string | null,
	organizationId: string | null,
) {
	const headers = new Headers(options.headers);
	if (options.body && !(options.body instanceof FormData))
		headers.set('Content-Type', 'application/json');
	if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
	if (organizationId) headers.set('X-Organization-Id', organizationId);
	const url = `${API_BASE_URL}/${path.replace(/^\//, '')}`;
	return onUploadProgress
		? sendWithProgress(url, options, headers, onUploadProgress)
		: fetch(url, { ...options, headers });
}

// Answers like fetch: a Response for every HTTP status, a TypeError when no answer came.
function sendWithProgress(
	url: string,
	options: RequestInit,
	headers: Headers,
	onProgress: (fraction: number) => void,
): Promise<Response> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open(options.method ?? 'GET', url);
		headers.forEach((value, name) => request.setRequestHeader(name, value));
		request.responseType = 'blob';
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress(event.loaded / event.total);
		};
		// apiRequest reads only the status and the body.
		request.onload = () =>
			resolve(
				new Response(
					[204, 205, 304].includes(request.status) ? null : (request.response as Blob),
					{
						status: request.status,
					},
				),
			);
		request.onerror = () => reject(new TypeError('Network request failed'));
		request.onabort = () => reject(new DOMException('The upload was stopped.', 'AbortError'));
		options.signal?.addEventListener('abort', () => request.abort(), { once: true });
		request.send((options.body as XMLHttpRequestBodyInit | null | undefined) ?? null);
	});
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
