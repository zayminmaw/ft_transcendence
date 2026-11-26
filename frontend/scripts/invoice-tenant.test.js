import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, MutationObserver } from '@tanstack/react-query';
import { loadTypeScript } from './load-typescript-for-test.js';

for (const lostResponse of [false, true]) {
	test(`invoice ${lostResponse ? 'lost response' : 'success'} invalidates its submitting company after switching companies`, async (t) => {
		const client = new QueryClient();
		t.after(() => client.clear());
		let company = 'A';
		const key = (...parts) => ['tenant', 'user', company, ...parts];
		const a = [...key('clients'), 'invoices', '7'];
		client.setQueryData(a, { items: [] });
		company = 'B';
		const b = [...key('clients'), 'invoices', '8'];
		client.setQueryData(b, { items: [] });
		company = 'A';
		let finish;
		let started;
		const requestStarted = new Promise((resolve) => {
			started = resolve;
		});
		const response = new Promise((resolve) => {
			finish = resolve;
		});
		let requestedCompany;
		const { useCreateInvoice } = loadTypeScript(
			new URL('../src/modules/billing/hooks/useCreateInvoice.ts', import.meta.url),
			{
				'@tanstack/react-query': {
					useQueryClient: () => client,
					useMutation: (options) => {
						const observer = new MutationObserver(client, options);
						return {
							...observer.getCurrentResult(),
							mutate: observer.mutate.bind(observer),
						};
					},
				},
				'@utils/query-keys': { tenantQueryKey: key },
				'@services/api-client': {
					apiRequest: async () => {
						requestedCompany = company;
						started();
						await response;
						if (lostResponse) throw new Error('Response lost after commit');
						return { id: 'saved-draft' };
					},
				},
			},
		);
		const action = useCreateInvoice().createInvoice({
			clientId: '7',
			periodStart: '2026-11-01',
			periodEnd: '2026-11-30',
		});
		await requestStarted;
		company = 'B';
		finish();
		if (lostResponse) await assert.rejects(action, /Response lost/);
		else await action;
		assert.equal(requestedCompany, 'A');
		assert.equal(client.getQueryState(a).isInvalidated, true);
		assert.equal(client.getQueryState(b).isInvalidated, false);
	});
}
