import { useSyncExternalStore } from 'react';
import { sessionStore } from '@app/store/session';

export function useAuth() {
	return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
}
