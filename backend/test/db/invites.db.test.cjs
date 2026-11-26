const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { JwtService } = require('@nestjs/jwt');
const { createTestDatabase } = require('./test-database.cjs');
const { AuditLog, AuditService } = require('../../dist/modules/audit');
const { Organization, OrganizationMember } = require('../../dist/modules/organizations');
const { Role } = require('../../dist/modules/rbac');
const { User, UsersRepository } = require('../../dist/modules/users');
const { SessionsService } = require('../../dist/modules/auth/sessions.service');
const { SessionsRepository } = require('../../dist/modules/auth/sessions.repository');
const { AuthAuditRepository } = require('../../dist/modules/auth/auth-audit.repository');
const { UserSession } = require('../../dist/modules/auth/entities/user-session.entity');
const { MemberInvite } = require('../../dist/modules/members/entities/member-invite.entity');
const { MembersRepository } = require('../../dist/modules/members/members.repository');
const { InvitesRepository } = require('../../dist/modules/members/invites.repository');
const { InvitesService } = require('../../dist/modules/members/invites.service');

let database, service, repository, audit, sessions, tenant, actorId;
const meta = { ip: '127.0.0.1', userAgent: 'invite-regression' };
const password = 'Strong-pass-1!';
before(async () => {
  database = await createTestDatabase();
  tenant = { organizationId: String((await database.getRepository(Organization).save({ name: 'Invites', slug: 'invite-db-review', contactEmail: 'org@invite.test' })).id), roleId: '1' };
  actorId = String((await database.getRepository(User).save({ username: 'inviter', email: 'inviter@invite.test', passwordHash: 'placeholder' })).id);
  const roles = database.getRepository(Role);
  if (!await roles.findOneBy({ code: 'dispatcher' })) await roles.save({ code: 'dispatcher', name: 'Dispatcher', description: null });
  audit = new AuditService(database.getRepository(AuditLog));
  repository = new InvitesRepository(database);
  sessions = new SessionsService(new SessionsRepository(database.getRepository(UserSession)), new UsersRepository(database.getRepository(User)), new JwtService({ secret: 'invite-db-test-secret-at-least-32-chars' }), new AuthAuditRepository(audit));
  service = new InvitesService(repository, new MembersRepository(database), sessions, audit);
});
after(() => database?.destroy());
const invite = () => service.create(tenant, actorId, { roleCode: 'dispatcher' }, meta);
const signup = (token, username) => service.signup({ token, username, email: `${username}@invite.test`, password }, meta);
const counts = async () => Promise.all([User, OrganizationMember, UserSession, AuditLog].map(entity => database.getRepository(entity).count()));

test('an audit failure rolls invite creation back instead of leaving a token nobody received', async () => {
  const before = await database.getRepository(MemberInvite).count();
  const real = audit.record;
  audit.record = async () => { throw new Error('Injected audit failure'); };
  try { await assert.rejects(invite(), /Injected audit failure/); }
  finally { audit.record = real; }
  assert.equal(await database.getRepository(MemberInvite).count(), before);
});

test('revocation and its audit commit together', async () => {
  const made = await invite();
  const real = audit.record;
  audit.record = async () => { throw new Error('Injected revoke audit failure'); };
  try { await assert.rejects(service.revoke(tenant, actorId, made.invite.id, meta), /Injected revoke audit failure/); }
  finally { audit.record = real; }
  assert.equal((await repository.find(tenant.organizationId, made.invite.id)).revokedAt, null);
  await service.revoke(tenant, actorId, made.invite.id, meta);
  await assert.rejects(service.inspect(made.token), error => error.getResponse().code === 'INVITE_INVALID');
});

test('failure after session insertion rolls signup back and the same invite can be retried', async () => {
  const made = await invite();
  const before = await counts();
  const real = sessions.jwt.signAsync;
  sessions.jwt.signAsync = async () => { throw new Error('Injected signing failure'); };
  try { await assert.rejects(signup(made.token, 'session.retry'), /Injected signing failure/); }
  finally { sessions.jwt.signAsync = real; }
  assert.deepEqual(await counts(), before);
  assert.equal((await repository.find(tenant.organizationId, made.invite.id)).usedAt, null);
  const result = await signup(made.token, 'session.retry');
  assert.equal(result.user.username, 'session.retry');
  assert.ok(result.session.refreshToken);
  const claims = await sessions.jwt.verifyAsync(result.session.accessToken);
  assert.equal(claims.sub, result.user.id);
  assert.notEqual(claims.mustChangePassword, true);
  assert.equal(await database.getRepository(UserSession).countBy({ userId: result.user.id }), 1);
});

test('concurrent acceptance of one token creates one account, membership and session', async () => {
  const made = await invite();
  const before = await counts();
  const result = await Promise.allSettled([signup(made.token, 'first.accept'), signup(made.token, 'second.accept')]);
  assert.equal(result.filter(entry => entry.status === 'fulfilled').length, 1);
  assert.equal(result.find(entry => entry.status === 'rejected').reason.getResponse().code, 'INVITE_INVALID');
  const after = await counts();
  assert.deepEqual(after.slice(0, 3), before.slice(0, 3).map(count => count + 1));
});
