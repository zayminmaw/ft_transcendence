import { useEffect, useState } from 'react';
import { refreshSession } from '@services/session-refresh';
import { useAuth } from './useAuth';

// After a page load only the refresh cookie remembers the session, so it is tried once. True while that runs.
export function useSessionCheck() {
	const { accessToken, ended } = useAuth();
	const [checking, setChecking] = useState(accessToken === null && ended === null);

	useEffect(() => {
		if (!checking) return;
		let mounted = true;
		void refreshSession().finally(() => {
			if (mounted) setChecking(false);
		});
		return () => {
			mounted = false;
		};
	}, [checking]);

	return checking;
}
