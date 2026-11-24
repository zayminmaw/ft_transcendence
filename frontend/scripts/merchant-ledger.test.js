import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver, keepPreviousData } from '@tanstack/react-query';
import { loadTypeScript } from './load-typescript-for-test.js';

function elements(node) {
	if (!node || typeof node !== 'object') return [];
	if (Array.isArray(node)) return node.flatMap(elements);
	return [node, ...elements(node.props?.children)];
}

function ledgerFixture(t, firstResponse) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: Infinity } },
	});
	const values = [];
	let stateIndex = 0;
	let response = firstResponse;
	let observer;
	let unsubscribe;
	const requests = [];
	const i18n = { useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) };
	const { useMerchantLedger } = loadTypeScript(
		new URL('../src/modules/billing/hooks/useMerchantLedger.ts', import.meta.url),
		{
			react: {
				useEffect() {},
				useState(initial) {
					const slot = stateIndex++;
					if (!(slot in values)) values[slot] = initial;
					return [
						values[slot],
						(next) => {
							values[slot] = next;
						},
					];
				},
			},
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
			'react-i18next': i18n,
			'@global-components': { useToast: () => ({ toast() {} }) },
			'@utils/query-keys': {
				tenantQueryKey: (...parts) => ['tenant', 'user', 'company', ...parts],
			},
			'@services/api-client': {
				apiRequest: async (path) => {
					requests.push(path);
					if (response instanceof Error) throw response;
					return typeof response === 'function' ? response(path) : response;
				},
			},
		},
		{ URLSearchParams },
	);
	const hook = (clientId) => {
		stateIndex = 0;
		return useMerchantLedger(clientId);
	};
	const { MerchantLedger } = loadTypeScript(
		new URL('../src/modules/billing/components/MerchantLedger.tsx', import.meta.url),
		{
			'react-i18next': i18n,
			'@global-components': { Table: 'ledger-table' },
			'@utils/format': { formatDate: () => 'November 1' },
			'../hooks/useMerchantLedger': { useMerchantLedger: hook },
		},
	);
	t.after(() => {
		unsubscribe?.();
		observer?.destroy();
		client.clear();
	});
	return {
		hook,
		requests,
		render: (clientId = 'A') => elements(MerchantLedger({ clientId })),
		response: (value) => {
			response = value;
		},
		refetch: () => observer.refetch(),
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

const page = (id) => ({ items: [{ id }], total: 1 });

test('a failed initial ledger load displays an error and retry, then a confirmed empty response displays the table', async (t) => {
	const ledger = ledgerFixture(t, new Error('Unavailable'));
	ledger.render();
	await ledger.settled();
	const failed = ledger.render();
	assert.ok(failed.some((element) => element.props?.role === 'alert'));
	assert.ok(!failed.some((element) => element.type === 'ledger-table'));
	ledger.response({ items: [], total: 0 });
	failed
		.find((element) => element.type === 'button' && element.props.children === 'ledger.retry')
		.props.onClick();
	await ledger.settled();
	const table = ledger.render().find((element) => element.type === 'ledger-table');
	assert.ok(table);
	assert.equal(table.props.rows.length, 0);
	assert.equal(table.props.pagination.total, 0);
	assert.equal(ledger.requests.length, 2);
});

test('a failed refresh does not display stale ledger lines as current data', async (t) => {
	const ledger = ledgerFixture(t, page('A-line'));
	ledger.render();
	await ledger.settled();
	ledger.response(new Error('Unavailable'));
	await ledger.refetch();
	assert.ok(!ledger.render().some((element) => element.type === 'ledger-table'));
});

test('pagination keeps the previous page only within the same merchant', async (t) => {
	const ledger = ledgerFixture(t, page('A-line'));
	ledger.hook('A');
	await ledger.settled();
	let finish;
	ledger.response(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			}),
	);
	ledger.hook('A').setPage(2);
	assert.equal(ledger.hook('A').entries[0].id, 'A-line');
	finish(page('A-next'));
	await ledger.settled();
	assert.equal(ledger.hook('A').entries[0].id, 'A-next');
});

test('changing merchant keys cannot reuse the previous merchant rows', async (t) => {
	const ledger = ledgerFixture(t, page('A-line'));
	ledger.hook('A');
	await ledger.settled();
	let finish;
	ledger.response(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			}),
	);
	const next = ledger.hook('B');
	assert.equal(next.entries.length, 0);
	assert.equal(next.isPending, true);
	finish(page('B-line'));
	await ledger.settled();
	assert.equal(ledger.hook('B').entries[0].id, 'B-line');
});

test('cached client detail route changes remount the ledger to reset pagination', () => {
	let clientId = 'A';
	const { ClientDetailsPage } = loadTypeScript(
		new URL('../src/modules/clients/pages/ClientDetailsPage.tsx', import.meta.url),
		{
			react: { useState: (value) => [value, () => {}] },
			'react-i18next': {
				useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }),
			},
			'react-router-dom': { Link: 'link', useParams: () => ({ clientId }) },
			'@global-components': { DetailItem: 'detail', ModulePage: 'module', TipCard: 'tip' },
			'@hooks/useCompanyPath': { useCompanyPath: () => (path) => path },
			'@modules/auth': {
				useCan: () => (permission) => permission === 'clients.view_financials',
			},
			'@modules/billing': { MerchantLedger: 'merchant-ledger' },
			'@utils/format': { formatDate: () => 'November 1' },
			'../components/ArchiveClientDialog': { ArchiveClientDialog: 'archive' },
			'../components/ClientNotFound': { ClientNotFound: 'not-found' },
			'../components/ClientStatusBadge': { ClientStatusBadge: 'status' },
			'../hooks/useClients': {
				useClientDetails: () => ({
					client: { id: clientId, businessName: clientId, isActive: true },
					isClientPending: false,
				}),
			},
			'../utils/rateTier': { isRateTier: () => false },
		},
	);
	const render = () =>
		elements(ClientDetailsPage()).find((element) => element.type === 'merchant-ledger');
	assert.equal(render().key, 'A');
	clientId = 'B';
	assert.equal(render().key, 'B');
});
