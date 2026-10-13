export interface SessionState {
	accessToken: string | null;
	activeOrganizationId: string | null;
}

let session: SessionState = { accessToken: null, activeOrganizationId: null };
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
	clear() {
		sessionStore.setSession({ accessToken: null, activeOrganizationId: null });
	},
};
