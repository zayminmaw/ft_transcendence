import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './load-typescript-for-test.js';

function liveUpdates() {
	const handlers = new Map();
	const timers = new Map();
	const effects = [];
	const invalidations = [];
	let timerId = 0;
	let connects = 0;
	const socket = {
		on: (event, handler) => handlers.set(event, handler),
		connect: () => {
			connects++;
		},
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
				useAuth: () => ({ accessToken: 'token', activeOrganizationId: 'company' }),
			},
		},
		{
			setTimeout: (callback) => {
				timers.set(++timerId, callback);
				return timerId;
			},
			clearTimeout: (id) => timers.delete(id),
		},
	);
	const liveNotifications = loadTypeScript(
		new URL('../src/hooks/live-notifications.ts', import.meta.url),
		{},
	);
	const { useLiveUpdates } = loadTypeScript(
		new URL('../src/hooks/useLiveUpdates.ts', import.meta.url),
		{
			react: { useRef: (current) => ({ current }) },
			'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
			'@global-components': { useToast: () => ({ toast() {} }) },
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
			'@utils/query-keys': { tenantQueryKey: () => ['tenant', 'user', 'company'] },
		},
	);
	useLiveUpdates();
	const cleanups = effects
		.map((effect) => effect())
		.filter((value) => typeof value === 'function');
	return {
		invalidations,
		connects: () => connects,
		timerCount: () => timers.size,
		emit: (event, value) => handlers.get(event)(value),
		retry() {
			const [id, callback] = timers.entries().next().value;
			timers.delete(id);
			callback();
		},
		cleanup: () => cleanups.forEach((cleanup) => cleanup()),
	};
}

test('a healthy first connection does not refetch freshly loaded data', () => {
	const live = liveUpdates();
	live.emit('connect');
	assert.equal(live.invalidations.length, 0);
	live.cleanup();
});

test('an initially unavailable handshake catches up tenant queries on recovery', () => {
	const live = liveUpdates();
	live.emit('connect_error', new Error('Unavailable'));
	assert.equal(live.invalidations.length, 0);
	live.retry();
	assert.equal(live.connects(), 1);
	live.emit('connect');
	assert.equal(live.invalidations.length, 1);
	const query = live.invalidations[0];
	assert.equal(JSON.stringify(query.queryKey), JSON.stringify(['tenant', 'user', 'company']));
	assert.equal(query.predicate({ queryKey: ['tenant', 'user', 'company', 'parcels'] }), true);
	assert.equal(query.predicate({ queryKey: ['tenant', 'user', 'company', 'audit-logs'] }), false);
	live.cleanup();
});

test('repeated initial refusals cause one catch-up and later reconnects still catch up', () => {
	const live = liveUpdates();
	for (let attempt = 0; attempt < 3; attempt++) {
		live.emit('connect_error', new Error('Unavailable'));
		live.retry();
	}
	assert.equal(live.invalidations.length, 0);
	live.emit('connect');
	assert.equal(live.invalidations.length, 1);
	live.emit('disconnect', 'transport close');
	live.emit('connect');
	assert.equal(live.invalidations.length, 2);
	live.cleanup();
});

test('recovery from an initial transport failure also catches up', () => {
	const live = liveUpdates();
	live.emit('connect_error', new Error('xhr poll error'));
	live.emit('connect');
	assert.equal(live.invalidations.length, 1);
	live.cleanup();
});

test('cleanup cancels retries and ignores a late connection from the old socket', () => {
	const live = liveUpdates();
	live.emit('connect_error', new Error('Unavailable'));
	assert.equal(live.timerCount(), 1);
	live.cleanup();
	assert.equal(live.timerCount(), 0);
	live.emit('connect');
	assert.equal(live.invalidations.length, 0);
});
