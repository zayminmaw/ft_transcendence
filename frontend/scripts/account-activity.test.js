import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { loadTypeScript } from './load-typescript-for-test.js';

test('activity keeps earlier pages only for the same account during an account switch', async (t) => {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: Infinity } },
	});
	let userId = 'A';
	let observer;
	let unsubscribe;
	const requests = [];
	const { useMyActivity } = loadTypeScript(
		new URL('../src/modules/auth/hooks.ts', import.meta.url),
		{
			'@tanstack/react-query': {
				useQuery(options) {
					if (!observer) {
						observer = new QueryObserver(client, options);
						unsubscribe = observer.subscribe(() => {});
					} else observer.setOptions(options);
					return observer.getCurrentResult();
				},
			},
			'react-i18next': {},
			'react-router-dom': {},
			'@app/store/session': {},
			'@hooks/useAuth': { useAuth: () => ({ userId }) },
			'@services/session-refresh': {},
			'./api': {
				fetchMyActivity: () => new Promise((resolve) => requests.push({ userId, resolve })),
			},
		},
	);
	t.after(() => {
		unsubscribe?.();
		observer?.destroy();
		client.clear();
	});
	const first = { items: [{ id: 'private-A' }] };
	useMyActivity({ page: 1 });
	requests[0].resolve(first);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(useMyActivity({ page: 1 }).data, first);
	assert.equal(useMyActivity({ page: 2 }).data, first, 'same-account pagination may retain data');
	userId = 'B';
	const switched = useMyActivity({ page: 2 });
	assert.equal(switched.data, undefined, 'never show account A activity under account B');
	assert.equal(switched.isPending, true);
	const own = { items: [{ id: 'private-B' }] };
	requests.at(-1).resolve(own);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(useMyActivity({ page: 2 }).data, own);
});
