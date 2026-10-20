import { useEffect, useState } from 'react';
import {
	checkSessionOnce,
	forgetSessionCheck,
	sessionCheckResult,
} from '@services/session-refresh';
import { useAuth } from './useAuth';

// After a page load only the refresh cookie remembers the session, so it is tried once per page load (see
// checkSessionOnce). `unavailable`: the server didn't answer; `retry` tries again.
export function useSessionCheck() {
	const { accessToken, ended } = useAuth();
	const needed = accessToken === null && ended === null;
	const [result, setResult] = useState(sessionCheckResult);

	useEffect(() => {
		if (!needed || result !== null) return;
		let mounted = true;
		void checkSessionOnce().then((outcome) => {
			if (mounted) setResult(outcome);
		});
		return () => {
			mounted = false;
		};
	}, [needed, result]);

	return {
		checking: needed && result === null,
		unavailable: needed && result === 'unavailable',
		retry: () => {
			forgetSessionCheck();
			setResult(null);
		},
	};
}
