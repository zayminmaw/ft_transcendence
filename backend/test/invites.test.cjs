const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MembersModule } = require('../dist/modules/members');
const { hashPassword } = require('../dist/modules/users/password');
const { ORIGIN, PASSWORD, as, createAuthApp, createFakeStore, refreshCookie, tokenFor } = require('./helpers/auth-app.cjs');

process.env.NODE_ENV = 'test';

async function inviteApp(t) {
  const passwordHash = await hashPassword(PASSWORD);
  const store = createFakeStore();
  store.roles.push(
    { id: 1, code: 'org_admin', name: 'Organization Admin', description: 'Runs the company' },
    { id: 2, code: 'dispatcher', name: 'Dispatcher', description: 'Assigns parcels' },
    { id: 3, code: 'driver', name: 'Driver', description: 'Delivers parcels' },
    { id: 9, code: 'platform_admin', name: 'Platform Admin', description: 'Platform' },
  );
  store.rolePermissions.set('1', new Set(['admin.manage_users', 'admin.manage_roles']));
  store.rolePermissions.set('2', new Set(['parcels.view']));
  store.users.push(
    { id: '10', username: 'lina', email: 'lina@meridian.example.test', passwordHash, isActive: true, lastLoginAt: null },
    { id: '12', username: 'dana.saleh', email: 'dana@meridian.example.test', passwordHash, isActive: true, lastLoginAt: null },
    { id: '15', username: 'karim.harbor', email: 'karim@harbor.example.test', passwordHash, isActive: true, lastLoginAt: null },
  );
  store.memberships.push(
    { organizationId: '1', userId: '10', roleId: '1', isActive: true },
    { organizationId: '1', userId: '12', roleId: '2', isActive: true },
    { organizationId: '2', userId: '15', roleId: '1', isActive: true },
  );
  return { store, ...(await createAuthApp(t, store, { imports: [MembersModule] })) };
}

test('company admin creates, lists, and revokes invite links; non-admins and cross-company admins are refused', async (t) => {
  const { server, store } = await inviteApp(t);
  const lina = await tokenFor(server, 'lina');
  const dana = await tokenFor(server, 'dana.saleh');
  const karim = await tokenFor(server, 'karim.harbor');

  await as(request(server).post('/api/members/invites'), dana).send({ roleCode: 'dispatcher' }).expect(403);
  await as(request(server).post('/api/members/invites'), lina).send({ roleCode: 'platform_admin' }).expect(403);
  await as(request(server).post('/api/members/invites'), lina).send({ roleCode: 'dispatcher', email: 'not-an-email' }).expect(400);
  await as(request(server).post('/api/members/invites'), lina)
    .send({ roleCode: 'dispatcher', email: 'DANA@meridian.example.test' })
    .expect(409);

  const created = await as(request(server).post('/api/members/invites'), lina)
    .send({ roleCode: 'dispatcher', email: 'samira@meridian.example.test' })
    .expect(201);
  assert.equal(typeof created.body.token, 'string');
  assert.ok(created.body.token.length >= 32);
  assert.equal(created.body.invite.email, 'samira@meridian.example.test');
  assert.equal(created.body.invite.role.code, 'dispatcher');
  assert.equal(created.body.invite.status, 'pending');
  assert.equal(created.body.invite.tokenHash, undefined);
  assert.notEqual(store.invites[0].tokenHash, created.body.token);

  // Listed only for Meridian, never Harbor.
  const meridianList = (await as(request(server).get('/api/members/invites'), lina).expect(200)).body;
  assert.equal(meridianList.length, 1);
  const harborList = (await as(request(server).get('/api/members/invites'), karim, '2').expect(200)).body;
  assert.equal(harborList.length, 0);

  // Harbor admin cannot revoke Meridian's invite.
  await as(request(server).delete(`/api/members/invites/${created.body.invite.id}`), karim, '2').expect(404);

  // Meridian admin revokes it; public inspection refuses it at once.
  await as(request(server).delete(`/api/members/invites/${created.body.invite.id}`), lina).expect(204);
  const afterRevoke = (await as(request(server).get('/api/members/invites'), lina).expect(200)).body;
  assert.equal(afterRevoke[0].status, 'revoked');
  await request(server).get(`/api/auth/invites/${created.body.token}`).expect(404);
});

test('invited user inspects invite, signs up with own password, receives session without mustChangePassword, and token cannot be reused', async (t) => {
  const { server, store, jwt } = await inviteApp(t);
  const lina = await tokenFor(server, 'lina');

  const created = await as(request(server).post('/api/members/invites'), lina)
    .send({ roleCode: 'driver', email: 'tariq@meridian.example.test' })
    .expect(201);
  const { token, invite } = created.body;

  const preview = (await request(server).get(`/api/auth/invites/${token}`).expect(200)).body;
  assert.deepEqual(preview.organization, { name: 'Meridian Courier', slug: 'meridian-courier' });
  assert.deepEqual(preview.role, { code: 'driver', name: 'Driver' });
  assert.equal(preview.email, 'tariq@meridian.example.test');

  // SameOriginGuard blocks cross-origin signup.
  await request(server)
    .post('/api/auth/signup')
    .set('Origin', 'https://evil.example')
    .send({ token, username: 'tariq.driver', password: 'Strong-pass-1!' })
    .expect(403);

  // Email mismatch against locked invite is refused.
  const mismatch = await request(server)
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ token, username: 'tariq.driver', email: 'other@meridian.example.test', password: 'Strong-pass-1!' })
    .expect(400);
  assert.equal(mismatch.body.code, 'INVITE_EMAIL_MISMATCH');

  // Weak password is refused without consuming the invite.
  const weak = await request(server)
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ token, username: 'tariq.driver', password: 'weakpassword' })
    .expect(400);
  assert.equal(weak.body.code, 'PASSWORD_RULE');

  // Valid signup succeeds, creates active membership, sets refresh cookie, and marks invite used.
  const res = await request(server)
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ token, username: 'tariq.driver', displayName: 'Tariq Mansour', password: 'Strong-pass-1!' })
    .expect(201);
  assert.equal(res.body.organizationSlug, 'meridian-courier');
  assert.equal(res.body.user.username, 'tariq.driver');
  assert.equal(res.body.user.email, 'tariq@meridian.example.test');
  assert.equal(res.body.user.displayName, 'Tariq Mansour');
  assert.ok(refreshCookie(res));
  const claims = await jwt.verifyAsync(res.body.accessToken);
  assert.notEqual(claims.mustChangePassword, true);

  // New user can log in immediately with their chosen email and password.
  const loggedIn = await tokenFor(server, 'tariq@meridian.example.test', 'Strong-pass-1!');
  assert.ok(loggedIn);

  // Invite cannot be inspected, reused, or revoked after use.
  await request(server).get(`/api/auth/invites/${token}`).expect(404);
  const replay = await request(server)
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ token, username: 'second.user', password: 'Strong-pass-1!' })
    .expect(404);
  assert.equal(replay.body.code, 'INVITE_INVALID');
  const revokeUsed = await as(request(server).delete(`/api/members/invites/${invite.id}`), lina).expect(409);
  assert.equal(revokeUsed.body.code, 'INVITE_ALREADY_USED');
  assert.ok(store.auditEntries.some((entry) => entry.resourceType === 'member' && entry.resourceLabel === 'tariq.driver'));
});

test('open invite (no pre-bound email) requires user email and rejects expired or suspended-org invites', async (t) => {
  const { server, store } = await inviteApp(t);
  const lina = await tokenFor(server, 'lina');

  const open = await as(request(server).post('/api/members/invites'), lina)
    .send({ roleCode: 'dispatcher' })
    .expect(201);
  assert.equal(open.body.invite.email, null);

  // Missing email fails validation.
  const noEmail = await request(server)
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ token: open.body.token, username: 'open.user', password: 'Strong-pass-1!' })
    .expect(400);
  assert.equal(noEmail.body.code, 'INVALID_EMAIL');

  // Suspended organization invalidates invite inspection and signup.
  store.organizations[0].isActive = false;
  await request(server).get(`/api/auth/invites/${open.body.token}`).expect(404);
  store.organizations[0].isActive = true;

  // Providing a valid email completes signup.
  const signed = await request(server)
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ token: open.body.token, username: 'open.user', email: 'open.user@meridian.example.test', password: 'Strong-pass-1!' })
    .expect(201);
  assert.equal(signed.body.user.email, 'open.user@meridian.example.test');

  // Expired invite is refused.
  const expiring = await as(request(server).post('/api/members/invites'), lina)
    .send({ roleCode: 'dispatcher' })
    .expect(201);
  store.invites.find((row) => row.id === expiring.body.invite.id).expiresAt = new Date(Date.now() - 1000);
  await request(server).get(`/api/auth/invites/${expiring.body.token}`).expect(404);
  await request(server)
    .post('/api/auth/signup')
    .set('Origin', ORIGIN)
    .send({ token: expiring.body.token, username: 'late.user', email: 'late@meridian.example.test', password: 'Strong-pass-1!' })
    .expect(404);
});

