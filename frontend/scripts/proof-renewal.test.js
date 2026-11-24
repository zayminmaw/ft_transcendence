import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './load-typescript-for-test.js';

function hooks() {
	const slots = [];
	let index = 0;
	let effects = [];
	const changed = (a, b) => !a || a.some((value, i) => value !== b[i]);
	return {
		begin() {
			index = 0;
			effects = [];
		},
		flush() {
			for (const run of effects) run();
		},
		dispose() {
			for (const slot of slots) slot?.cleanup?.();
		},
		useState(initial) {
			const at = index++;
			if (!(at in slots)) slots[at] = typeof initial === 'function' ? initial() : initial;
			return [
				slots[at],
				(next) => {
					slots[at] = typeof next === 'function' ? next(slots[at]) : next;
				},
			];
		},
		useRef(initial) {
			const at = index++;
			return (slots[at] ??= { current: initial });
		},
		useCallback(callback, deps) {
			const at = index++;
			if (changed(slots[at]?.deps, deps)) slots[at] = { deps, callback };
			return slots[at].callback;
		},
		useEffect(effect, deps) {
			const at = index++;
			if (changed(slots[at]?.deps, deps))
				effects.push(() => {
					slots[at]?.cleanup?.();
					slots[at] = { deps, cleanup: effect() };
				});
		},
	};
}

function nodes(node) {
	if (!node || typeof node !== 'object') return [];
	if (Array.isArray(node)) return node.flatMap(nodes);
	if (typeof node.type === 'function') return nodes(node.type(node.props));
	return [node, ...nodes(node.props?.children)];
}

function preview({ seconds = 900, mimeType = 'image/png', reject = false } = {}) {
	let now = 1_800_000_000_000;
	let state = hooks();
	let key;
	let refreshed = 0;
	let finish;
	let saved = {
		url: `/api/storage/files/1?exp=${now / 1000 + seconds}&sig=first`,
		mimeType,
		name: 'proof',
	};
	const timers = new Map();
	let timerId = 0;
	const url = class extends URL {};
	const revoked = [];
	url.createObjectURL = () => 'blob:local-proof';
	url.revokeObjectURL = (value) => revoked.push(value);
	const { ProofPreview } = loadTypeScript(
		new URL('../src/modules/parcels/components/ProofPreview.tsx', import.meta.url),
		{
			react: Object.fromEntries(
				['useState', 'useRef', 'useCallback', 'useEffect'].map((name) => [
					name,
					(...args) => state[name](...args),
				]),
			),
			'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
			'@global-components': { ImageViewer: 'viewer' },
			'@utils/upload': { PDF_TYPE: 'application/pdf' },
		},
		{
			URL: url,
			Date: class extends Date {
				static now() {
					return now;
				}
			},
			queueMicrotask,
			setTimeout: (callback, delay) => {
				const id = ++timerId;
				timers.set(id, { callback, at: now + delay });
				return id;
			},
			clearTimeout: (id) => timers.delete(id),
		},
	);
	const onRefresh = () => {
		refreshed++;
		return new Promise((resolve, fail) => {
			finish = () => (reject ? fail(new Error('offline')) : resolve());
		});
	};
	return {
		render(local) {
			const root = ProofPreview({ saved, local, label: 'Signature', onRefresh });
			if (root.key !== key) {
				state.dispose();
				state = hooks();
				key = root.key;
			}
			state.begin();
			const tree = root.type(root.props);
			state.flush();
			return { tree, nodes: nodes(tree), root };
		},
		advance(ms, runTimers = true) {
			now += ms;
			if (runTimers)
				for (const [id, timer] of [...timers])
					if (timer.at <= now) {
						timers.delete(id);
						timer.callback();
					}
		},
		fresh() {
			saved = { ...saved, url: `/api/storage/files/1?exp=${now / 1000 + 900}&sig=fresh` };
		},
		finish: async () => {
			finish();
			await new Promise(queueMicrotask);
		},
		calls: () => refreshed,
		timers: () => timers.size,
		dispose: () => state.dispose(),
		revoked,
	};
}

test('a saved image renews before expiry and uses the replacement URL', async () => {
	const page = preview();
	const old = page.render();
	assert.match(old.nodes.find((node) => node.type === 'img').props.src, /sig=first/);
	page.advance(869_999);
	assert.equal(page.calls(), 0);
	page.advance(1);
	assert.equal(page.calls(), 1);
	assert.equal(
		page.render().nodes.some((node) => node.type === 'img'),
		false,
	);
	page.fresh();
	await page.finish();
	const renewed = page.render();
	assert.notEqual(renewed.root.key, old.root.key);
	assert.match(renewed.nodes.find((node) => node.type === 'img').props.src, /sig=fresh/);
	assert.equal(page.timers(), 1);
	page.dispose();
	assert.equal(page.timers(), 0);
});

test('a PDF cannot open an expired link after background timers were delayed', () => {
	const page = preview({ mimeType: 'application/pdf' });
	const shown = page.render();
	assert.equal(
		shown.nodes.some((node) => node.type === 'iframe'),
		true,
	);
	page.advance(901_000, false);
	let prevented = false;
	shown.tree.props.onClickCapture({
		preventDefault: () => {
			prevented = true;
		},
		stopPropagation() {},
	});
	assert.equal(prevented, true);
	assert.equal(page.calls(), 1);
	assert.equal(
		page.render().nodes.some((node) => node.type === 'a' || node.type === 'iframe'),
		false,
	);
	page.dispose();
});

test('an already expired link is hidden on the first render and immediately refreshed', () => {
	const page = preview({ seconds: -1 });
	assert.equal(
		page.render().nodes.some((node) => node.type === 'img'),
		false,
	);
	page.advance(0);
	assert.equal(page.calls(), 1);
	page.dispose();
});

test('an image failure deduplicates renewal, keeps failed data hidden and offers explicit retry', async () => {
	const page = preview({ reject: true });
	const image = page.render().nodes.find((node) => node.type === 'img');
	image.props.onError();
	image.props.onError();
	assert.equal(page.calls(), 1);
	await page.finish();
	const failure = page.render();
	assert.equal(
		failure.nodes.some((node) => node.props.role === 'alert'),
		true,
	);
	assert.equal(
		failure.nodes.some((node) => node.type === 'img'),
		false,
	);
	page.advance(900_000);
	assert.equal(page.calls(), 1);
	const retry = page.render().nodes.find((node) => node.type === 'button');
	retry.props.onClick();
	assert.equal(page.calls(), 2);
	page.dispose();
});

test('local upload previews use an object URL and never request signed-link renewal', async () => {
	const page = preview();
	const local = new File(['image'], 'local.png', { type: 'image/png' });
	page.render(local);
	await new Promise(queueMicrotask);
	assert.equal(
		page.render(local).nodes.find((node) => node.type === 'img').props.src,
		'blob:local-proof',
	);
	assert.equal(page.calls(), 0);
	assert.equal(page.timers(), 0);
	page.dispose();
	assert.deepEqual(page.revoked, ['blob:local-proof']);
});
