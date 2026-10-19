// Why the last session ended: the login page explains an expired session, but not a logout.
export type SessionEnd = 'logout' | 'expired';

export interface SessionState {
	accessToken: string | null;
	userId: string | null;
	activeOrganizationId: string | null;
	ended: SessionEnd | null;
}

let session: SessionState = {
	accessToken: null,
	userId: null,
	activeOrganizationId: null,
	ended: null,
};
const listeners = new Set<() => void>();

export const sessionStore = {
	getSnapshot: () => session,
	subscribe(listener: () => void) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},
	setSession(next: SessionState) {
		session = { ...next };
		listeners.forEach((listener) => listener());
	},
	// A refresh keeps the open company; a different account (logged in from another tab) starts with none.
	start(accessToken: string, userId: string) {
		sessionStore.setSession({
			accessToken,
			userId,
			activeOrganizationId: session.userId === userId ? session.activeOrganizationId : null,
			ended: null,
		});
	},
	end(reason: SessionEnd) {
		sessionStore.setSession({
			accessToken: null,
			userId: null,
			activeOrganizationId: null,
			ended: reason,
		});
	},
};
