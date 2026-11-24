import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './load-typescript-for-test.js';

function statefulHooks() {
	const values = [];
	let index = 0;
	return {
		begin: () => {
			index = 0;
		},
		useState(initial) {
			const slot = index++;
			if (!(slot in values)) values[slot] = initial;
			return [
				values[slot],
				(next) => {
					values[slot] = typeof next === 'function' ? next(values[slot]) : next;
				},
			];
		},
	};
}

function elements(node) {
	if (!node || typeof node !== 'object') return [];
	if (Array.isArray(node)) return node.flatMap(elements);
	return [node, ...elements(node.props?.children)];
}

function payoutPage() {
	const pageState = statefulHooks();
	const dialogState = statefulHooks();
	let client = {
		id: '1',
		businessName: 'Merchant A',
		clientCode: 'A',
		currentBalance: '120.00',
		isActive: true,
		createdAt: '2026-11-01T00:00:00Z',
	};
	let payError = null;
	const requests = [];
	const notifications = [];
	const i18n = { useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }) };
	const globalComponents = {
		Dialog: 'dialog',
		Input: 'input',
		DetailItem: 'detail',
		ModulePage: 'module',
		TipCard: 'tip',
		useToast: () => ({ toast: (value) => notifications.push(value) }),
	};
	const utils = loadTypeScript(new URL('../src/modules/billing/utils.ts', import.meta.url), {
		'@services/api-client': { ApiError: Error },
	});
	const { PayoutDialog } = loadTypeScript(
		new URL('../src/modules/billing/components/PayoutDialog.tsx', import.meta.url),
		{
			react: { useState: dialogState.useState },
			'react-i18next': i18n,
			'@global-components': globalComponents,
			'../utils': utils,
			'../hooks/usePayout': {
				usePayout: () => ({
					isPaying: false,
					payError,
					resetPay: () => {
						payError = null;
					},
					payMerchant(values, callbacks) {
						requests.push(JSON.parse(JSON.stringify(values)));
						if (requests.length === 1) {
							// The server committed, the response was lost, and client invalidation returns the cleared balance.
							client = { ...client, currentBalance: '0.00' };
							payError = new Error('Response lost');
						} else callbacks.onSuccess({ ...values, repeated: true });
					},
				}),
			},
		},
		{
			FormData: class {
				constructor(values) {
					this.values = values;
				}
				get(name) {
					return this.values[name];
				}
			},
		},
	);
	const { ClientDetailsPage } = loadTypeScript(
		new URL('../src/modules/clients/pages/ClientDetailsPage.tsx', import.meta.url),
		{
			react: { useState: pageState.useState },
			'react-i18next': i18n,
			'react-router-dom': { Link: 'link', useParams: () => ({ clientId: client.id }) },
			'@global-components': globalComponents,
			'@hooks/useCompanyPath': { useCompanyPath: () => (path) => path },
			'@modules/auth': {
				useCan: () => (permission) =>
					['clients.view_financials', 'billing.adjust_balance'].includes(permission),
			},
			'@modules/billing': { PayoutDialog },
			'@utils/format': { formatDate: () => 'November 1' },
			'../components/ArchiveClientDialog': { ArchiveClientDialog: 'archive' },
			'../components/ClientNotFound': { ClientNotFound: 'not-found' },
			'../components/ClientStatusBadge': { ClientStatusBadge: 'status' },
			'../hooks/useClients': { useClientDetails: () => ({ client, isClientPending: false }) },
			'../utils/rateTier': { isRateTier: () => false },
		},
	);
	const render = () => {
		pageState.begin();
		const tree = elements(ClientDetailsPage());
		const modal = tree.find((element) => element.type === PayoutDialog);
		if (!modal) return { tree, modal: null, dialog: null };
		dialogState.begin();
		return { tree, modal, dialog: PayoutDialog(modal.props) };
	};
	return {
		render,
		requests,
		notifications,
		client: (values) => {
			client = { ...client, ...values };
		},
		open: () =>
			render()
				.tree.find(
					(element) =>
						element.type === 'button' && element.props.children === 'details.payOut',
				)
				.props.onClick(),
		submit: (amount = '120.00', wireReference = 'WIRE-0123') =>
			render().dialog.props.onSubmit({
				preventDefault() {},
				currentTarget: { amount, wireReference },
			}),
	};
}

test('a lost full-payout response keeps the dialog, amount, error and same-reference retry available', () => {
	const page = payoutPage();
	page.open();
	page.submit();
	const { tree, modal, dialog } = page.render();
	assert.ok(modal, 'the zero balance must not unmount the current attempt');
	assert.equal(modal.props.client.balance, '0.00');
	assert.equal(
		elements(dialog).find((element) => element.props?.name === 'amount').props.defaultValue,
		'120.00',
	);
	assert.ok(elements(dialog).some((element) => element.props?.role === 'alert'));
	assert.ok(
		!tree.some(
			(element) => element.type === 'button' && element.props.children === 'details.payOut',
		),
	);
	page.submit();
	assert.deepEqual(page.requests, [
		{ clientId: '1', amount: '120.00', wireReference: 'WIRE-0123' },
		{ clientId: '1', amount: '120.00', wireReference: 'WIRE-0123' },
	]);
	assert.equal(page.render().modal, null);
	assert.equal(page.notifications.at(-1).title, 'payout.repeated');
});

test('a zero balance cannot open a new payout attempt', () => {
	const page = payoutPage();
	page.client({ currentBalance: '0.00' });
	const { tree, modal } = page.render();
	assert.equal(modal, null);
	assert.ok(
		!tree.some(
			(element) => element.type === 'button' && element.props.children === 'details.payOut',
		),
	);
});

test('an open attempt is not displayed under a different merchant', () => {
	const page = payoutPage();
	page.open();
	assert.ok(page.render().modal);
	page.client({ id: '2', businessName: 'Merchant B', currentBalance: '50.00' });
	assert.equal(page.render().modal, null);
});
