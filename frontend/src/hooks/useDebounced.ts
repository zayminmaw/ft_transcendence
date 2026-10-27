import { useEffect, useState } from 'react';

// The value once it has stopped changing for `delay` ms, e.g. a search box that waits for typing to pause.
export function useDebounced<T>(value: T, delay = 300) {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}
