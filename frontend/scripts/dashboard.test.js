import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './load-typescript-for-test.js';

function nodes(node) {
	if (!node || typeof node !== 'object') return [];
	if (Array.isArray(node)) return node.flatMap(nodes);
	return [node, ...nodes(node.props?.children), ...nodes(node.props?.actions)];
}

function dashboard(permissions, overrides = {}) {
	const query = () => ({ isPending: false, isError: false, refetch() {} });
	const data = Object.fromEntries(
		[
			'parcels',
			'dispatchDrivers',
			'clients',
			'drivers',
			'assets',
			'cashDrivers',
			'members',
			'invites',
			'insights',
			'contacts',
		].map((key) => [key, query()]),
	);
	Object.assign(data, overrides);
	const { TenantDashboardPage } = loadTypeScript(
		new URL('../src/modules/dashboard/pages/TenantDashboardPage.tsx', import.meta.url),
		{
			'react-router-dom': { Link: 'link' },
			'react-i18next': {
				useTranslation: () => ({ t: (key) => key, i18n: { language: 'en' } }),
			},
			'@global-components': { AnalyticsCard: 'analytics', ModulePage: 'page' },
			'@hooks/useCompanyPath': { useCompanyPath: () => (path) => `/app/demo/${path}` },
			'@modules/auth': {
				useCurrentWorkspace: () => undefined,
				useMe: () => ({}),
				useRoleName: () => () => '',
				shownName: () => '',
			},
			'@utils/format': { formatNumber: (value) => String(value ?? '—') },
			'../components/AdminWidgets': {
				ActivityInsightsWidget: 'activity',
				ContactsWidget: 'contacts',
				TeamAccessWidget: 'team',
			},
			'../components/FinanceWidget': { FinanceWidget: 'finance' },
			'../components/ParcelsWidget': { ParcelsWidget: 'parcels' },
			'../components/WorkforceWidgets': {
				DriversWidget: 'drivers',
				FleetWidget: 'fleet',
				MerchantsWidget: 'merchants',
			},
			'../hooks/useDashboardData': {
				useDashboardPermissions: () => permissions,
				useDashboardData: () => data,
			},
		},
	);
	return nodes(TenantDashboardPage());
}

test('failed dispatch availability shows a retryable driver error instead of a successful roster', () => {
	const retried = [];
	const view = dashboard(
		{ canViewDrivers: true, canDispatchParcels: true },
		{
			drivers: { isError: false, isPending: false, refetch: () => retried.push('drivers') },
			dispatchDrivers: {
				isError: true,
				isPending: false,
				refetch: () => retried.push('dispatch'),
			},
		},
	);
	const widget = view.find((node) => node.type === 'drivers');
	assert.equal(widget.props.isError, true);
	widget.props.onRetry();
	assert.deepEqual(retried, ['drivers', 'dispatch']);
});

test('dashboard actions and financial widgets require access to their destination datasets', () => {
	const view = dashboard({
		canCreateParcels: true,
		canDispatchParcels: true,
		canManageDrivers: true,
		canCreateAssets: true,
		canCreateClients: true,
		canViewClientFinancials: true,
	});
	assert.equal(
		view.some((node) => node.type === 'link'),
		false,
	);
	assert.equal(
		view.some((node) => node.type === 'finance'),
		false,
	);
});
