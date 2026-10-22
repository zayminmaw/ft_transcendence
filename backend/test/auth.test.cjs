const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { hashPassword } = require('../dist/modules/users/password');
const { ORIGIN, createAuthApp, createFakeStore, refreshCookie } = require('./helpers/auth-app.cjs');

// The cookie's Secure flag depends on NODE_ENV; pin it so a run in the development container checks the same flags.
process.env.NODE_ENV = 'test';

const PASSWORD = 'Correct-horse-1';
let passwordHash;

async function storeWithUsers() {
  passwordHash ??= await hashPassword(PASSWORD);
  const store = createFakeStore();
  store.users.push(
    { id: '2', username: 'dana.saleh', email: 'dana@meridian.example.test', passwordHash, isActive: true },
    { id: '3', username: 'ex.member', email: 'ex@meridian.example.test', passwordHash, isActive: false },
  );
  store.workspaces.set('2', [{ id: '1', slug: 'meridian-courier', name: 'Meridian Courier' }]);
  return store;
}

// Browsers always send Origin on a POST; login requires it like refresh and logout.
const login = (server, name, password = PASSWORD) => request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ login: name, password });
const refresh = (server, cookie) => {
  const call = request(server).post('/api/auth/refresh').set('Origin', ORIGIN);
  return cookie ? call.set('Cookie', `transcend_refresh=${encodeURIComponent(cookie)}`) : call;
};

test('login accepts an email or a username in any case and sets the refresh cookie', async (t) => {
  const { server, store, jwt } = await createAuthApp(t, await storeWithUsers());
  const byEmail = await login(server, 'DANA@Meridian.example.test').expect(200);
  assert.deepEqual(byEmail.body.user, { id: '2', username: 'dana.saleh', email: 'dana@meridian.example.test' });
  assert.equal((await jwt.verifyAsync(byEmail.body.accessToken)).sub, '2');
  assert.equal(byEmail.headers['cache-control'], 'no-store');
  const cookie = refreshCookie(byEmail);
  assert.ok(cookie.value.length >= 43);
  assert.match(cookie.header, /; Path=\/api\/auth/);
  assert.match(cookie.header, /; HttpOnly/);
  assert.match(cookie.header, /; Secure/);
  assert.match(cookie.header, /; SameSite=Strict/);
  assert.match(cookie.header, /; Expires=/);
  await login(server, 'Dana.Saleh').expect(200);
  assert.deepEqual(store.lastLogins, ['2', '2']);
  assert.deepEqual(store.audit.map((entry) => entry.action), ['login', 'login']);
});

test('login refuses an unknown login, a wrong password and an inactive account the same way', async (t) => {
  const { server, store } = await createAuthApp(t, await storeWithUsers());
  const responses = [
    await login(server, 'nobody').expect(401),
    await login(server, 'dana.saleh', 'Wrong-password-1').expect(401),
    await login(server, 'ex.member').expect(401),
  ];
  for (const response of responses) {
    assert.equal(response.body.code, 'AUTH_INVALID_CREDENTIALS');
    assert.equal(response.body.message, 'Unable to log in.');
    assert.equal(refreshCookie(response), undefined);
  }
  assert.deepEqual(store.audit.map((entry) => [entry.action, entry.userId]), [['login_failed', null], ['login_failed', '2'], ['login_failed', '3']]);
  assert.equal(store.sessions.length, 0);
});

test('refresh swaps the cookie and returns a new access token', async (t) => {
  const { server, store, jwt } = await createAuthApp(t, await storeWithUsers());
  const first = refreshCookie(await login(server, 'dana.saleh').expect(200)).value;
  const response = await refresh(server, first).expect(200);
  const second = refreshCookie(response).value;
  assert.notEqual(second, first);
  assert.equal((await jwt.verifyAsync(response.body.accessToken)).sub, '2');
  assert.deepEqual(response.body.user, { id: '2', username: 'dana.saleh', email: 'dana@meridian.example.test' });
  assert.equal(store.sessions.length, 1);
  assert.equal(store.sessionFor(second).id, '1');
});

test('using a replaced refresh token more than 10 seconds later ends the whole session', async (t) => {
  const { server, store } = await createAuthApp(t, await storeWithUsers());
  const first = refreshCookie(await login(server, 'dana.saleh').expect(200)).value;
  const second = refreshCookie(await refresh(server, first).expect(200)).value;
  store.sessionFor(second).rotatedAt = new Date(Date.now() - 11_000);
  const reused = await refresh(server, first).expect(401);
  assert.equal(reused.body.code, 'AUTH_SESSION_EXPIRED');
  assert.match(refreshCookie(reused).header, /Expires=Thu, 01 Jan 1970/);
  await refresh(server, second).expect(401);
  assert.equal(store.sessions[0].revokedReason, 'reuse');
  assert.deepEqual(store.audit.map((entry) => entry.action), ['login', 'session_reuse']);
});

test('a browser that missed a refresh answer can use the replaced token for 10 seconds', async (t) => {
  const { server, store } = await createAuthApp(t, await storeWithUsers());
  const kept = refreshCookie(await login(server, 'dana.saleh').expect(200)).value;
  const missed = refreshCookie(await refresh(server, kept).expect(200)).value;
  // A second reload cancelled that answer, so the browser still sends the token it had.
  const fresh = refreshCookie(await refresh(server, kept).expect(200)).value;
  await refresh(server, fresh).expect(200);
  assert.equal(store.sessions[0].revokedAt, null);
  assert.deepEqual(store.audit.map((entry) => entry.action), ['login']);
  // The answer that never arrived holds a token no browser has: if it ever turns up, it was copied.
  await refresh(server, missed).expect(401);
  assert.equal(store.sessions[0].revokedReason, 'reuse');
});

test('refresh refuses a missing cookie, expired sessions and deactivated accounts', async (t) => {
  const { server, store } = await createAuthApp(t, await storeWithUsers());
  await refresh(server).expect(401);
  const past = new Date(Date.now() - 1000);
  const idle = refreshCookie(await login(server, 'dana.saleh').expect(200)).value;
  store.sessionFor(idle).idleExpiresAt = past;
  await refresh(server, idle).expect(401);
  const absolute = refreshCookie(await login(server, 'dana.saleh').expect(200)).value;
  store.sessionFor(absolute).absoluteExpiresAt = past;
  await refresh(server, absolute).expect(401);
  const deactivated = refreshCookie(await login(server, 'dana.saleh').expect(200)).value;
  store.users[0].isActive = false;
  await refresh(server, deactivated).expect(401);
  assert.equal(store.sessionFor(deactivated).revokedReason, 'inactive');
});

test('refresh and logout refuse requests that do not come from our site', async (t) => {
  const { server } = await createAuthApp(t, await storeWithUsers());
  const cookie = `transcend_refresh=${encodeURIComponent(refreshCookie(await login(server, 'dana.saleh').expect(200)).value)}`;
  await request(server).post('/api/auth/refresh').set('Cookie', cookie).set('Origin', 'https://evil.example').expect(403);
  await request(server).post('/api/auth/refresh').set('Cookie', cookie).expect(403);
  await request(server).post('/api/auth/logout').set('Cookie', cookie).set('Origin', 'https://evil.example').expect(403);
});

test('logout ends the session and clears the cookie, even without a valid cookie', async (t) => {
  const { server, store } = await createAuthApp(t, await storeWithUsers());
  const cookie = refreshCookie(await login(server, 'dana.saleh').expect(200)).value;
  const response = await request(server).post('/api/auth/logout').set('Origin', ORIGIN)
    .set('Cookie', `transcend_refresh=${encodeURIComponent(cookie)}`).expect(204);
  assert.match(refreshCookie(response).header, /Expires=Thu, 01 Jan 1970/);
  assert.equal(store.sessions[0].revokedReason, 'logout');
  await refresh(server, cookie).expect(401);
  await request(server).post('/api/auth/logout').set('Origin', ORIGIN).expect(204);
  assert.deepEqual(store.audit.map((entry) => entry.action), ['login', 'logout']);
});

test('login slows down after 5 tries a minute for the same login name', async (t) => {
  const { server } = await createAuthApp(t, await storeWithUsers());
  for (let attempt = 0; attempt < 5; attempt += 1) await login(server, 'dana.saleh', 'Wrong-password-1').expect(401);
  const limited = await login(server, 'DANA.SALEH ').expect(429);
  assert.equal(limited.body.code, 'AUTH_TOO_MANY_ATTEMPTS');
  assert.equal(limited.body.message, 'Too many attempts. Wait a minute and try again.');
  // A different login name from the same address still gets a normal answer.
  await login(server, 'someone.else').expect(401);
});

test('login slows down after 20 tries a minute from one address, whatever the login name', async (t) => {
  const { server } = await createAuthApp(t, await storeWithUsers());
  for (let attempt = 0; attempt < 20; attempt += 1) await login(server, `guess${attempt}`).expect(401);
  assert.equal((await login(server, 'guess-final').expect(429)).body.code, 'AUTH_TOO_MANY_ATTEMPTS');
});

test('me works without a company and returns the user, workspaces and platform access', async (t) => {
  const store = await storeWithUsers();
  store.platformAdmins.add('2');
  const { server } = await createAuthApp(t, store);
  const { accessToken } = (await login(server, 'dana.saleh').expect(200)).body;
  const me = await request(server).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
  assert.deepEqual(me.body, {
    user: { id: '2', username: 'dana.saleh', email: 'dana@meridian.example.test' },
    workspaces: [{ id: '1', slug: 'meridian-courier', name: 'Meridian Courier' }],
    platformAccess: true,
    mustChangePassword: false,
  });
  await request(server).get('/api/auth/me').expect(401);
  store.users[0].isActive = false;
  await request(server).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(403);
});

test('login refuses requests from another site, including a plain HTML form post', async (t) => {
  const { server, store } = await createAuthApp(t, await storeWithUsers());
  const crossSite = await request(server).post('/api/auth/login').set('Origin', 'https://evil.example')
    .send({ login: 'dana.saleh', password: PASSWORD }).expect(403);
  assert.equal(refreshCookie(crossSite), undefined);
  // An auto-submitted <form> sends url-encoded fields, which Nest parses too.
  await request(server).post('/api/auth/login').set('Origin', 'https://evil.example').type('form')
    .send(`login=dana.saleh&password=${encodeURIComponent(PASSWORD)}`).expect(403);
  await request(server).post('/api/auth/login').send({ login: 'dana.saleh', password: PASSWORD }).expect(403);
  assert.equal(store.sessions.length, 0);
  assert.deepEqual(store.audit, []);
});

test('login names are plain ASCII, so accented look-alikes cannot dodge the per-name limit', async (t) => {
  const { server, store } = await createAuthApp(t, await storeWithUsers());
  for (let attempt = 0; attempt < 5; attempt += 1) await login(server, 'dana.saleh', 'Wrong-password-1').expect(401);
  // The database collation treats "dána.salèh" as "dana.saleh"; it must never reach the password check.
  const accented = await login(server, 'dána.salèh', 'Wrong-password-1').expect(400);
  assert.equal(accented.body.code, undefined);
  assert.equal(store.audit.length, 5);
  // Spaces around the name are trimmed before the check, so a copy-pasted login still works.
  const fresh = await createAuthApp(t, await storeWithUsers());
  await login(fresh.server, '  dana.saleh  ').expect(200);
});

test('a token copied and refreshed twice is still caught when the old token comes back', async (t) => {
  const { server, store } = await createAuthApp(t, await storeWithUsers());
  const stolen = refreshCookie(await login(server, 'dana.saleh').expect(200)).value;
  const second = refreshCookie(await refresh(server, stolen).expect(200)).value;
  const third = refreshCookie(await refresh(server, second).expect(200)).value;
  // Two generations later the original token comes back: the session must end, not just refuse this one token.
  assert.equal((await refresh(server, stolen).expect(401)).body.code, 'AUTH_SESSION_EXPIRED');
  await refresh(server, third).expect(401);
  assert.equal(store.sessions[0].revokedReason, 'reuse');
  assert.deepEqual(store.audit.map((entry) => entry.action), ['login', 'session_reuse']);
});

test('other logins (42) set the refresh cookie through the same exported helper', () => {
  const auth = require('../dist/modules/auth');
  assert.equal(typeof auth.SessionsService, 'function');
  assert.equal(typeof auth.requestMeta, 'function');
  const calls = [];
  const expires = new Date('2026-11-17T00:00:00Z');
  auth.setRefreshCookie({ cookie: (...args) => calls.push(args) }, { refreshToken: 'token-value', absoluteExpiresAt: expires });
  assert.deepEqual(calls, [['transcend_refresh', 'token-value', { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth', expires }]]);
});

test('development leaves Secure off the refresh cookie, because Safari drops it on http://localhost', (t) => {
  const { clearedRefreshCookieOptions, refreshCookieOptions } = require('../dist/modules/auth/refresh-cookie');
  t.after(() => { process.env.NODE_ENV = 'test'; });
  const expires = new Date('2026-11-17T00:00:00Z');
  for (const [mode, secure] of [['development', false], ['production', true], ['test', true]]) {
    process.env.NODE_ENV = mode;
    assert.equal(refreshCookieOptions(expires).secure, secure, mode);
    assert.equal(clearedRefreshCookieOptions().secure, secure, mode);
  }
});

test('logging out with a token replaced more than 10 seconds ago is treated as a copied token', async (t) => {
  const { server, store } = await createAuthApp(t, await storeWithUsers());
  const stolen = refreshCookie(await login(server, 'dana.saleh').expect(200)).value;
  const current = refreshCookie(await refresh(server, stolen).expect(200)).value;
  store.sessionFor(current).rotatedAt = new Date(Date.now() - 11_000);
  await request(server).post('/api/auth/logout').set('Origin', ORIGIN)
    .set('Cookie', `transcend_refresh=${encodeURIComponent(stolen)}`).expect(204);
  assert.equal(store.sessions[0].revokedReason, 'reuse');
  assert.deepEqual(store.audit.map((entry) => entry.action), ['login', 'session_reuse']);
  await refresh(server, current).expect(401);
});

test('logging out with the token a refresh just replaced is a normal logout', async (t) => {
  const { server, store } = await createAuthApp(t, await storeWithUsers());
  const kept = refreshCookie(await login(server, 'dana.saleh').expect(200)).value;
  await refresh(server, kept).expect(200);
  await request(server).post('/api/auth/logout').set('Origin', ORIGIN)
    .set('Cookie', `transcend_refresh=${encodeURIComponent(kept)}`).expect(204);
  assert.equal(store.sessions[0].revokedReason, 'logout');
  assert.deepEqual(store.audit.map((entry) => entry.action), ['login', 'logout']);
});

test('login works from the site\'s own hostname even when it differs from CORS_ORIGIN', async (t) => {
  const { server } = await createAuthApp(t, await storeWithUsers());
  // Opening the app by IP: the browser sends Origin https://127.0.0.1; NGINX passes Host 127.0.0.1 and
  // X-Forwarded-Proto https.
  await request(server).post('/api/auth/login').set('Host', '127.0.0.1').set('X-Forwarded-Proto', 'https')
    .set('Origin', 'https://127.0.0.1').send({ login: 'dana.saleh', password: PASSWORD }).expect(200);
});

test('refusals from another site or another origin on the same host carry AUTH_FORBIDDEN_ORIGIN', async (t) => {
  const { server } = await createAuthApp(t, await storeWithUsers());
  // A different login name per try, so the 5-per-minute login limit (checked first) never answers instead.
  const attempt = (headers, index) => {
    let call = request(server).post('/api/auth/login').set('Host', 'localhost').set('X-Forwarded-Proto', 'https');
    for (const [name, value] of Object.entries(headers)) call = call.set(name, value);
    return call.send({ login: `origin.check${index}`, password: PASSWORD }).expect(403);
  };
  for (const [index, headers] of [
    { Origin: 'https://evil.example' },
    { Origin: 'https://evil.example', 'X-Forwarded-Host': 'evil.example' },
    // Same hostname, but another app on another port or scheme is a different origin.
    { Origin: 'http://localhost:9999' },
    { Origin: 'http://localhost' },
    { Origin: 'null' },
    {},
  ].entries()) {
    const refused = await attempt(headers, index);
    assert.equal(refused.body.code, 'AUTH_FORBIDDEN_ORIGIN');
    assert.equal(refused.body.message, 'Requests must come from this site.');
  }
});
