import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './load-typescript-for-test.js';

test('invite links keep bearer tokens in the fragment and preview requests keep them in the body', async () => {
	const { createInviteUrl, inviteTokenFromHash } = loadTypeScript(
		new URL('../src/modules/auth/invite-link.ts', import.meta.url),
		{},
		{ URL, URLSearchParams },
	);
	const token = 'disposable-token_that-is-never-a-request-url';
	const link = new URL(createInviteUrl('https://transcend.example', token));
	assert.equal(link.pathname, '/signup');
	assert.equal(link.search, '');
	assert.equal(inviteTokenFromHash(link.hash), token);
	assert.equal(inviteTokenFromHash(''), '');
	let sent;
	const { inspectInvite } = loadTypeScript(
		new URL('../src/modules/auth/api.ts', import.meta.url),
		{
			'@modules/audit': {},
			'@services/api-client': {
				apiRequest: async (path, options) => {
					sent = { path, options };
				},
			},
		},
	);
	await inspectInvite(token);
	assert.equal(sent.path, 'auth/invites/preview');
	assert.equal(sent.options.method, 'POST');
	assert.equal(JSON.parse(sent.options.body).token, token);
	assert.ok(!sent.path.includes(token));
});
