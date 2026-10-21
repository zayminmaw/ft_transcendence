import { queryClient } from '@app/store/query-client';
import { sessionStore } from '@app/store/session';
import type { SessionEnd } from '@app/store/session';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// 'ended': the server refused the cookie (401). 'unavailable': no answer, or any other error (a restart, 429, 5xx).
// The session may still be fine then, so nothing ends.
export type RefreshResult = 'ok' | 'ended' | 'unavailable';

// Every tab shares the refresh cookie, and each use replaces it. Two tabs using it at once would look like a
// copied token and end the session, so the browser lock lets one tab at a time use it.
async function withCookieLock<T>(task: () => Promise<T>): Promise<T> {
	return navigator.locks ? navigator.locks.request('transcend-refresh', task) : task();
}

// Logging out in one tab ends the session in the browser's other tabs too: they still hold access tokens.
const tabs =
	typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('transcend-session');
tabs?.addEventListener('message', ({ data }) => {
	if (data === 'logout' && sessionStore.getSnapshot().accessToken) endSession('logout');
});

let pending: Promise<RefreshResult> | null = null;

// Gets a new access token from the refresh cookie. Calls made while one is running share its answer.
export function refreshSession(): Promise<RefreshResult> {
	pending ??= withCookieLock(requestRefresh)
		.catch((): RefreshResult => 'unavailable')
		.finally(() => {
			pending = null;
		});
	return pending;
}

async function requestRefresh(): Promise<RefreshResult> {
	try {
		const response = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST' });
		if (response.status === 401) return 'ended';
		if (!response.ok) return 'unavailable';
		const { accessToken, user }: { accessToken: string; user: { id: string } } =
			await response.json();
		sessionStore.start(accessToken, user.id);
		return 'ok';
	} catch {
		return 'unavailable';
	}
}

// After a page load only the refresh cookie remembers the session. It is tried once per page load, however many
// screens ask (a guard, then the login page it sends a logged-out visitor to).
let pageLoadCheck: Promise<RefreshResult> | null = null;
let pageLoadResult: RefreshResult | null = null;

export function checkSessionOnce(): Promise<RefreshResult> {
	pageLoadCheck ??= refreshSession().then((result) => (pageLoadResult = result));
	return pageLoadCheck;
}

export function sessionCheckResult(): RefreshResult | null {
	return pageLoadResult;
}

// After 'unavailable', Try again starts the page-load check over.
export function forgetSessionCheck() {
	pageLoadCheck = null;
	pageLoadResult = null;
}

// Ends the session on the server first. If that fails, the cookie would log the next person straight back in, so the
// session stays and the caller shows an error.
export async function logOut(): Promise<void> {
	const response = await withCookieLock(() =>
		fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' }),
	);
	if (!response.ok) throw new Error(`Logout failed with status ${response.status}.`);
	tabs?.postMessage('logout');
	endSession('logout');
}

export function endSession(reason: SessionEnd) {
	queryClient.clear();
	sessionStore.end(reason);
}
