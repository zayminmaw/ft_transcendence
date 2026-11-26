import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadTypeScript } from './load-typescript-for-test.js';

const liveNotifications = loadTypeScript(
	new URL('../src/hooks/live-notifications.ts', import.meta.url),
	{},
);

function loadLocale(language) {
	return JSON.parse(
		readFileSync(new URL(`../src/locales/${language}/common.json`, import.meta.url), 'utf8'),
	);
}

function createTranslator(locale) {
	return (key, options = {}) => {
		const value = key.split('.').reduce((acc, part) => acc?.[part], locale);
		assert.equal(typeof value, 'string', `Missing translation key "${key}"`);
		return value.replaceAll(/{{\s*(\w+)\s*}}/g, (_, name) => options[name] ?? `{{${name}}}`);
	};
}

function createPayload(overrides = {}) {
	return {
		action: 'CREATE',
		module: 'parcels',
		resourceId: '42',
		organizationId: '1',
		timestamp: '2026-11-26T12:00:00.000Z',
		...overrides,
	};
}

function setupLiveUpdates({ language = 'en', activeOrganizationId = '1' } = {}) {
	const handlers = new Map();
	const effects = [];
	const invalidations = [];
	const toasts = [];
	const t = createTranslator(loadLocale(language));
	const socket = {
		on: (event, handler) => handlers.set(event, handler),
		connect() {},
		disconnect() {},
	};
	const { useWebSocket } = loadTypeScript(
		new URL('../src/hooks/useWebSocket.ts', import.meta.url),
		{
			react: {
				useRef: (current) => ({ current }),
				useEffect: (effect) => effects.push(effect),
			},
			'socket.io-client': { io: () => socket },
			'@app/store/session': {
				sessionStore: { getSnapshot: () => ({ accessToken: 'token' }) },
			},
			'@services/session-refresh': { refreshSession: async () => 'ok', endSession() {} },
			'./useAuth': {
				useAuth: () => ({ accessToken: 'token', activeOrganizationId }),
			},
		},
		{ setTimeout, clearTimeout },
	);
	const { useLiveUpdates } = loadTypeScript(
		new URL('../src/hooks/useLiveUpdates.ts', import.meta.url),
		{
			react: { useRef: (current) => ({ current }) },
			'react-i18next': { useTranslation: () => ({ t }) },
			'@global-components': {
				useToast: () => ({
					toast: (item) => {
						toasts.push(item);
						return String(toasts.length);
					},
				}),
			},
			'./live-notifications': liveNotifications,
			'./useWebSocket': { useWebSocket },
			'@app/store/query-client': {
				queryClient: {
					invalidateQueries: async (query) => {
						invalidations.push(query);
					},
				},
			},
			'@modules/contacts': { applyPresence() {} },
			'@utils/query-keys': {
				tenantQueryKey: (...parts) => ['tenant', 'user', activeOrganizationId, ...parts],
			},
		},
	);
	useLiveUpdates();
	const cleanups = effects
		.map((effect) => effect())
		.filter((value) => typeof value === 'function');
	return {
		invalidations,
		toasts,
		emit: (event, value) => handlers.get(event)(value),
		cleanup: () => cleanups.forEach((cleanup) => cleanup()),
	};
}

test('formats CREATE, UPDATE, and DELETE notifications across en, ar, and th locales', () => {
	const modules = ['parcels', 'clients', 'drivers', 'assets', 'billing', 'members'];
	const actions = ['CREATE', 'UPDATE', 'DELETE'];

	for (const language of ['en', 'ar', 'th']) {
		const t = createTranslator(loadLocale(language));
		for (const module of modules) {
			for (const action of actions) {
				const toast = liveNotifications.formatLiveNotification(
					createPayload({ action, module, resourceId: '99' }),
					t,
				);
				assert.ok(toast, `Expected toast for ${language}/${module}/${action}`);
				assert.equal(toast.variant, 'info');
				assert.ok(toast.title.length > 0);
				assert.ok(!toast.title.includes('{{'));
				assert.ok(toast.description.includes('99'));
				assert.ok(!toast.description.includes('{{'));
			}
		}
	}
});

test('falls back to the localized unknown module label for unrecognized modules', () => {
	const t = createTranslator(loadLocale('en'));
	assert.equal(
		liveNotifications.notificationModuleKey('parcels'),
		'liveNotifications.modules.parcels',
	);
	assert.equal(
		liveNotifications.notificationModuleKey('future-module'),
		'liveNotifications.modules.unknown',
	);
	const toast = liveNotifications.formatLiveNotification(
		createPayload({ action: 'UPDATE', module: 'future-module', resourceId: '7' }),
		t,
	);
	assert.deepEqual(
		{ ...toast },
		{
			variant: 'info',
			title: 'Workspace updated',
			description: 'Record #7',
		},
	);
});

test('deduplicates identical notifications within the burst window and allows later or distinct events', () => {
	const deduplicator = liveNotifications.createNotificationDeduplicator(3_000);
	const base = createPayload({ action: 'UPDATE', module: 'parcels', resourceId: '42' });

	assert.equal(deduplicator.shouldNotify(base, 1_000), true);
	assert.equal(deduplicator.shouldNotify(base, 2_500), false);
	assert.equal(deduplicator.shouldNotify({ ...base, resourceId: '43' }, 2_500), true);
	assert.equal(deduplicator.shouldNotify({ ...base, action: 'DELETE' }, 2_500), true);
	assert.equal(deduplicator.shouldNotify({ ...base, module: 'clients' }, 2_500), true);
	assert.equal(deduplicator.shouldNotify({ ...base, organizationId: '2' }, 2_500), true);

	// After the 3 s window elapses for base, it notifies again while newer distinct entries remain active.
	assert.equal(deduplicator.shouldNotify(base, 4_000), true);
	assert.equal(deduplicator.size(), 5);

	// Once all earlier entries have expired, pruning leaves only the newly recorded entry.
	assert.equal(deduplicator.shouldNotify({ ...base, resourceId: '99' }, 7_000), true);
	assert.equal(deduplicator.size(), 1);
});

test('useLiveUpdates invalidates tenant queries and shows deduplicated info toasts', () => {
	const live = setupLiveUpdates({ language: 'en', activeOrganizationId: '1' });
	const event = createPayload({
		action: 'CREATE',
		module: 'parcels',
		resourceId: '101',
		organizationId: '1',
	});

	live.emit('notification', event);
	live.emit('notification', event);
	live.emit('notification', { ...event, action: 'DELETE' });
	// Different organization event is ignored by useWebSocket.
	live.emit('notification', { ...event, organizationId: '2' });

	assert.equal(live.invalidations.length, 3);
	assert.equal(
		JSON.stringify(live.invalidations[0].queryKey),
		JSON.stringify(['tenant', 'user', '1', 'parcels']),
	);
	assert.equal(live.toasts.length, 2);
	assert.deepEqual(
		{ ...live.toasts[0] },
		{
			variant: 'info',
			title: 'New item in Parcels',
			description: 'Record #101',
		},
	);
	assert.deepEqual(
		{ ...live.toasts[1] },
		{
			variant: 'info',
			title: 'Item removed from Parcels',
			description: 'Record #101',
		},
	);
	live.cleanup();
});
