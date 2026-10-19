import { queryClient } from '@app/store/query-client';
import { sessionStore } from '@app/store/session';
import type { SessionEnd } from '@app/store/session';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Every tab shares the refresh cookie, and each use replaces it. Two tabs using it at once would look like a
// copied token and end the session, so the browser lock lets one tab at a time use it.
async function withCookieLock<T>(task: () => Promise<T>): Promise<T> {
	return navigator.locks ? navigator.locks.request('transcend-refresh', task) : task();
}

let pending: Promise<boolean> | null = null;

// Gets a new access token from the refresh cookie. Calls made while one is running share its answer.
export function refreshSession(): Promise<boolean> {
	pending ??= withCookieLock(requestRefresh).finally(() => {
		pending = null;
	});
	return pending;
}

async function requestRefresh(): Promise<boolean> {
	const response = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST' }).catch(
		() => null,
	);
	if (!response?.ok) return false;
	const { accessToken, user }: { accessToken: string; user: { id: string } } =
		await response.json();
	sessionStore.start(accessToken, user.id);
	return true;
}

export async function logOut(): Promise<void> {
	await withCookieLock(() =>
		fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' }).catch(() => undefined),
	);
	endSession('logout');
}

export function endSession(reason: SessionEnd) {
	queryClient.clear();
	sessionStore.end(reason);
}
