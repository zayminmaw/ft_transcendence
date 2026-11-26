import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver, MutationObserver } from '@tanstack/react-query';
import { loadTypeScript } from './load-typescript-for-test.js';

function elements(node) {
	if (!node || typeof node !== 'object') return [];
	if (Array.isArray(node)) return node.flatMap(elements);
	return [node, ...elements(node.props?.children)];
}

class ApiError extends Error {
	constructor(status, message, code) {
		super(message);
		this.status = status;
		this.code = code;
	}
}
const parcels = (count) =>
	Array.from({ length: count }, (_, index) => ({
		id: String(index + 1),
		trackingNumber: `TRC-${index + 1}`,
		clientId: '7',
		codAmount: '0.10',
		deliveredAt: null,
	}));

function fixture(t, initialParcels = parcels(1)) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
	});
	const queries = new Map();
	const values = [];
	let stateIndex = 0;
	let mutation;
	let action;
	let waiting = { driverId: '3', expectedTotal: '0.10', parcels: initialParcels };
	let waitingError;
	let failure;
	let afterPost;
	const requests = [];
	const paths = [];
	const notifications = [];
	const translations = { useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) };
	const globals = {
		Input: 'input',
		ModulePage: 'module',
		Select: 'select',
		Table: 'table',
		TipCard: 'tip',
		useToast: () => ({ toast: (notification) => notifications.push(notification) }),
	};
	const services = {
		ApiError,
		apiRequest: async (path, options) => {
			paths.push(path);
			if (options?.method === 'POST') {
				requests.push(JSON.parse(options.body));
				afterPost?.();
				if (failure) throw failure;
				return {
					id: 'saved',
					reference: requests.at(-1).settlementReference,
					totalCashDropped: requests.at(-1).totalCashDropped,
					repeated: requests.length > 1,
				};
			}
			if (path.endsWith('/drivers'))
				return [{ id: '3', name: 'Former Driver', employeeCode: 'D3' }];
			if (waitingError) throw waitingError;
			return waiting;
		},
	};
	const hooks = loadTypeScript(
		new URL('../src/modules/billing/hooks/useCashHandover.ts', import.meta.url),
		{
			react: { useEffect() {} },
			'react-i18next': translations,
			'@global-components': globals,
			'@utils/query-keys': {
				tenantQueryKey: (...parts) => ['tenant', 'user', 'company', ...parts],
			},
			'@services/api-client': services,
			'@tanstack/react-query': {
				useQueryClient: () => client,
				useQuery(options) {
					const key = JSON.stringify(options.queryKey);
					if (!queries.has(key)) {
						const observer = new QueryObserver(client, options);
						queries.set(key, { observer, stop: observer.subscribe(() => {}) });
					}
					return queries.get(key).observer.getCurrentResult();
				},
				useMutation(options) {
					if (!mutation) {
						mutation = new MutationObserver(client, options);
						mutation.subscribe(() => {});
					}
					return {
						...mutation.getCurrentResult(),
						reset: () => mutation.reset(),
						mutate: (value, callbacks) => {
							action = mutation.mutate(value, callbacks);
							void action.catch(() => {});
						},
					};
				},
			},
		},
	);
	const utils = loadTypeScript(new URL('../src/modules/billing/utils.ts', import.meta.url), {
		'@services/api-client': services,
	});
	const cash = loadTypeScript(
		new URL('../src/modules/billing/cash-handover.ts', import.meta.url),
		{},
	);
	const { CashHandoverPage } = loadTypeScript(
		new URL('../src/modules/billing/pages/CashHandoverPage.tsx', import.meta.url),
		{
			react: {
				useState(initial) {
					const slot = stateIndex++;
					if (!(slot in values)) values[slot] = initial;
					return [
						values[slot],
						(value) => {
							values[slot] =
								typeof value === 'function' ? value(values[slot]) : value;
						},
					];
				},
			},
			'react-i18next': translations,
			'@global-components': globals,
			'@services/api-client': services,
			'@utils/format': { formatDate: (value) => value },
			'../cash-handover': cash,
			'../hooks/useCashHandover': hooks,
			'../utils': utils,
		},
	);
	const render = () => {
		stateIndex = 0;
		return elements(CashHandoverPage());
	};
	const table = () => render().find((node) => node.type === 'table');
	const input = (name) =>
		render().find((node) => node.type === 'input' && node.props.name === name);
	const setInput = (name, value) => input(name).props.onChange({ target: { value } });
	const settle = async () => {
		for (const { observer } of queries.values()) {
			if (observer.getCurrentResult().fetchStatus !== 'idle')
				await new Promise((resolve) => {
					const stop = observer.subscribe((result) => {
						if (result.fetchStatus === 'idle') {
							stop();
							resolve();
						}
					});
				});
		}
	};
	t.after(() => {
		for (const { observer, stop } of queries.values()) {
			stop();
			observer.destroy();
		}
		client.clear();
	});
	return {
		render,
		table,
		input,
		setInput,
		settle,
		requests,
		paths,
		notifications,
		async choose() {
			render();
			await settle();
			render()
				.find((node) => node.type === 'select')
				.props.onChange({ target: { value: '3' } });
			render();
			await settle();
		},
		async submit() {
			render()
				.find((node) => node.type === 'form')
				.props.onSubmit({ preventDefault() {} });
			await action?.catch(() => {});
		},
		select(id, checked) {
			const current = table();
			current.props.columns
				.find((column) => column.key === 'selected')
				.cell(current.props.rows.find((parcel) => parcel.id === id))
				.props.onChange({ target: { checked } });
		},
		response: (rows) => {
			waiting = { ...waiting, parcels: rows };
		},
		failure: (error, update) => {
			failure = error;
			afterPost = update;
		},
		loadError: (error) => {
			waitingError = error;
		},
	};
}

for (const newParcels of [[], parcels(2).slice(1)]) {
	test(`lost handover response preserves exact retry when ${newParcels.length ? 'new parcels arrive' : 'waiting list empties'}`, async (t) => {
		const page = fixture(t);
		await page.choose();
		assert.ok(page.paths.includes('billing/reconcile-cod/drivers'));
		page.setInput('cash', '0.10');
		page.setInput('reference', 'REF-1234');
		page.failure(new Error('Response lost'), () => page.response(newParcels));
		await page.submit();
		assert.ok(page.render().some((node) => node.props?.role === 'alert'));
		assert.equal(page.table().props.rows[0].id, '1');
		assert.equal(page.input('cash').props.readOnly, true);
		assert.equal(page.render().find((node) => node.type === 'select').props.disabled, true);
		page.failure(null);
		await page.submit();
		assert.deepEqual(page.requests, [
			{
				driverId: '3',
				settlementReference: 'REF-1234',
				totalCashDropped: '0.10',
				parcelIds: ['1'],
			},
			{
				driverId: '3',
				settlementReference: 'REF-1234',
				totalCashDropped: '0.10',
				parcelIds: ['1'],
			},
		]);
		assert.equal(page.notifications.at(-1).title, 'cashHandover.repeated');
		assert.equal(page.render().find((node) => node.type === 'select').props.disabled, false);
	});
}

test('more than 200 waiting parcels can be settled in selected batches with an exact money total', async (t) => {
	const page = fixture(t, parcels(201));
	await page.choose();
	const current = page.table();
	const checkbox = (id) =>
		current.props.columns[0].cell(current.props.rows.find((parcel) => parcel.id === id)).props;
	assert.equal(checkbox('201').disabled, true);
	page.select('1', false);
	page.select('201', true);
	page.setInput('cash', '20.00');
	page.setInput('reference', 'BATCH-1');
	page.failure(null, () => page.response(parcels(1)));
	await page.submit();
	assert.equal(page.requests[0].parcelIds.length, 200);
	assert.ok(!page.requests[0].parcelIds.includes('1'));
	assert.ok(page.requests[0].parcelIds.includes('201'));
	page.setInput('cash', '0.10');
	page.setInput('reference', 'BATCH-2');
	await page.submit();
	assert.deepEqual(page.requests[1].parcelIds, ['1']);
});

test('failed waiting loads show a persistent retryable error and never a false empty table', async (t) => {
	const page = fixture(t, []);
	page.loadError(new Error('Unavailable'));
	await page.choose();
	assert.ok(page.render().some((node) => node.props?.role === 'alert'));
	assert.equal(page.table(), undefined);
	page.loadError(null);
	page.render()
		.find((node) => node.type === 'button' && node.props.children === 'cashHandover.retry')
		.props.onClick();
	await page.settle();
	assert.equal(page.table().props.rows.length, 0);
	assert.ok(!page.render().some((node) => node.props?.role === 'alert'));
});

test('a definite refusal releases the request so the counted amount can be corrected', async (t) => {
	const page = fixture(t);
	await page.choose();
	page.setInput('cash', '0.09');
	page.setInput('reference', 'COUNT-1');
	page.failure(new ApiError(409, 'Wrong count', 'COD_DISCREPANCY'));
	await page.submit();
	assert.equal(page.input('cash').props.readOnly, false);
	page.setInput('cash', '0.10');
	page.failure(null);
	await page.submit();
	assert.equal(page.requests[1].totalCashDropped, '0.10');
});

test('handover totals use decimal cents for the selected subset', () => {
	const { handoverTotal } = loadTypeScript(
		new URL('../src/modules/billing/cash-handover.ts', import.meta.url),
		{},
	);
	assert.equal(handoverTotal(parcels(200)), '20.00');
	assert.equal(handoverTotal([]), '0.00');
});
