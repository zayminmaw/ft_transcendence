import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver, keepPreviousData } from '@tanstack/react-query';
import { loadTypeScript } from './load-typescript-for-test.js';

const number = 'TRC-ABCDEFGH1';
const parcel = (status = 'picked_up') => ({
	trackingNumber: number,
	status,
	company: 'Meridian',
	events: [],
});
const refusal = (status, code) => Object.assign(new Error(code), { status, code });

function elements(node) {
	if (!node || typeof node !== 'object') return [];
	if (Array.isArray(node)) return node.flatMap(elements);
	return [node, ...elements(node.props?.children)];
}

function trackingPage(t, firstAnswer) {
	const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
	const navigations = [];
	const requests = [];
	let answer = firstAnswer;
	let observer;
	let unsubscribe;
	const hooks = loadTypeScript(
		new URL('../src/modules/parcels/hooks/useParcels.ts', import.meta.url),
		{
			react: {},
			'@tanstack/react-query': {
				keepPreviousData,
				useQuery(options) {
					if (!observer) {
						observer = new QueryObserver(client, options);
						unsubscribe = observer.subscribe(() => {});
					} else observer.setOptions(options);
					return observer.getCurrentResult();
				},
			},
			'@global-components': {},
			'@hooks/useDebounced': {},
			'@utils/query-keys': {},
			'@services/api-client': {
				apiRequest: async (path) => {
					requests.push(path);
					if (answer instanceof Error) throw answer;
					return answer;
				},
				retryServerErrors: () => false,
			},
			'../api': {},
		},
	);
	const { TrackParcelPage } = loadTypeScript(
		new URL('../src/modules/parcels/pages/TrackParcelPage.tsx', import.meta.url),
		{
			react: { useEffect() {} },
			'react-i18next': {},
			'react-router-dom': {
				useParams: () => ({ trackingNumber: number }),
				useNavigate: () => (path) => navigations.push(path),
			},
			'@global-components': { Button: 'button', Input: 'input' },
			'@services/api-client': { errorCode: (error) => error.code },
			'@utils/format': {},
			'../constants': { parcelStatusLabels: {} },
			'../hooks/useParcels': hooks,
		},
		{
			FormData: class {
				constructor(values) {
					this.values = values;
				}
				get(key) {
					return this.values[key];
				}
			},
		},
	);
	const render = () => elements(TrackParcelPage());
	t.after(() => {
		unsubscribe?.();
		observer?.destroy();
		client.clear();
	});
	render();
	return {
		requests,
		navigations,
		render,
		answer: (value) => {
			answer = value;
		},
		result: () => observer.getCurrentResult(),
		refetch: () => observer.refetch(),
		submit(value) {
			render()
				.find((element) => element.type === 'form')
				.props.onSubmit({
					preventDefault() {},
					currentTarget: { tracking: value },
				});
		},
		async settled() {
			if (observer.getCurrentResult().fetchStatus === 'idle') return;
			await new Promise((resolve) => {
				const stop = observer.subscribe((result) => {
					if (result.fetchStatus === 'idle') {
						stop();
						resolve();
					}
				});
			});
		},
	};
}

test('resubmitting the same normalized number retries a rate-limited lookup', async (t) => {
	const page = trackingPage(t, refusal(429, 'TRACKING_TOO_MANY_LOOKUPS'));
	await page.settled();
	assert.equal(page.requests.length, 1);
	page.answer(parcel());
	page.submit(`  ${number.toLowerCase()}  `);
	await page.settled();
	assert.deepEqual(page.requests, [`tracking/${number}`, `tracking/${number}`]);
	assert.deepEqual(page.navigations, []);
	assert.equal(page.result().status, 'success');
});

test('resubmitting a successful lookup fetches its updated status', async (t) => {
	const page = trackingPage(t, parcel());
	await page.settled();
	page.answer(parcel('delivered'));
	page.submit(number);
	await page.settled();
	assert.equal(page.requests.length, 2);
	assert.equal(page.result().data.status, 'delivered');
});

test('a different number navigates to its tracking route', async (t) => {
	const page = trackingPage(t, parcel());
	await page.settled();
	page.submit(' trc-new-number ');
	assert.deepEqual(page.navigations, ['/track/TRC-NEW-NUMBER']);
	assert.equal(page.requests.length, 1);
});

for (const status of [403, 404]) {
	test(`a ${status} refresh hides retained cached results and shows the refusal`, async (t) => {
		const page = trackingPage(t, parcel());
		await page.settled();
		const cached = page.result().data;
		assert.ok(page.render().some((element) => element.props?.parcel === cached));
		const error = refusal(status, 'TRACKING_NOT_FOUND');
		page.answer(error);
		await page.refetch();
		assert.equal(page.result().data, cached, 'TanStack Query retains the last successful data');
		const rendered = page.render();
		assert.ok(!rendered.some((element) => element.props?.parcel === cached));
		assert.ok(rendered.some((element) => element.props?.error === error));
	});
}
