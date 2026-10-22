require('reflect-metadata');
const { ConfigModule } = require('@nestjs/config');
const { Reflector } = require('@nestjs/core');
const { JwtService } = require('@nestjs/jwt');
const { Test } = require('@nestjs/testing');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { configureApp } = require('../../dist/app.setup');
const { HttpExceptionFilter } = require('../../dist/common/filters/http-exception.filter');
const { TenantContextInterceptor } = require('../../dist/common/interceptors/tenant-context.interceptor');
const { AuthModule, JwtAuthGuard } = require('../../dist/modules/auth');
const { AuthAuditRepository } = require('../../dist/modules/auth/auth-audit.repository');
const { AuditLog } = require('../../dist/modules/auth/entities/audit-log.entity');
const { UserSession } = require('../../dist/modules/auth/entities/user-session.entity');
const { SessionsRepository } = require('../../dist/modules/auth/sessions.repository');
const { OrganizationMember } = require('../../dist/modules/organizations/entities/organization-member.entity');
const { OrganizationMembersRepository } = require('../../dist/modules/organizations/organization-members.repository');
const { RolesGuard } = require('../../dist/modules/rbac');
const { UserRole } = require('../../dist/modules/rbac/entities/user-role.entity');
const { PermissionsRepository } = require('../../dist/modules/rbac/permissions.repository');
const { PlatformRolesRepository } = require('../../dist/modules/rbac/platform-roles.repository');
const { User } = require('../../dist/modules/users/entities/user.entity');
const { UsersRepository } = require('../../dist/modules/users/users.repository');

const ORIGIN = 'http://localhost:5173';
const ENV = { JWT_SECRET: 'test-secret-with-at-least-32-characters', JWT_ISSUER: 'transcend', JWT_AUDIENCE: 'transcend-web', CORS_ORIGIN: ORIGIN };

// In-memory stand-ins for the SQL repositories: same method names and return shapes. test:db checks the real SQL.
function createFakeStore() {
  const store = {
    users: [], sessions: [], audit: [], workspaces: new Map(), platformAdmins: new Set(), lastLogins: [],
    // Company access for the guard: memberships ({ organizationId, userId, roleId, isActive }) and each role's codes.
    memberships: [], rolePermissions: new Map(),
  };
  let nextSessionId = 1;
  const sameText = (a, b) => a.toLowerCase() === b.toLowerCase();
  const sessionRecord = (row) => row && {
    id: row.id, userId: row.userId, idleExpiresAt: row.idleExpiresAt, absoluteExpiresAt: row.absoluteExpiresAt, revokedAt: row.revokedAt,
  };
  const lockedSession = (row) => row && {
    ...sessionRecord(row), familyId: row.familyId, tokenHash: row.tokenHash,
    previousTokenHash: row.previousTokenHash ?? null, rotatedAt: row.rotatedAt ?? null,
  };
  const revoke = async (id, reason, at) => {
    const row = store.sessions.find((session) => session.id === id && !session.revokedAt);
    if (row) Object.assign(row, { revokedAt: at, revokedReason: reason });
  };
  const sessionsTransaction = {
    lockByFamilyId: async (familyId) => lockedSession(store.sessions.find((row) => row.familyId === familyId)),
    rotate: async (id, change) => { Object.assign(store.sessions.find((row) => row.id === id), change); },
    revoke,
  };
  store.repositories = {
    users: {
      findByLogin: async (login) => store.users.find((user) => sameText(login.includes('@') ? user.email : user.username, login)),
      findById: async (id) => store.users.find((user) => user.id === id),
      isActive: async (id) => Boolean(store.users.find((user) => user.id === id)?.isActive),
      touchLastLogin: async (id) => { store.lastLogins.push(id); },
      updatePassword: async (id, passwordHash, mustChangePassword) => {
        Object.assign(store.users.find((user) => user.id === id), { passwordHash, mustChangePassword });
      },
    },
    sessions: {
      insert: async (session) => { store.sessions.push({ id: String(nextSessionId++), revokedAt: null, revokedReason: null, ...session }); },
      findActiveByFamilyId: async (familyId) => lockedSession(store.sessions.find((row) => row.familyId === familyId && !row.revokedAt)),
      revoke,
      revokeAllForUser: async (userId, reason, at, keepFamilyId) => {
        for (const row of store.sessions) {
          if (row.userId === userId && !row.revokedAt && row.familyId !== keepFamilyId) Object.assign(row, { revokedAt: at, revokedReason: reason });
        }
      },
      transaction: (work) => work(sessionsTransaction),
    },
    audit: { record: async (action, userId, meta) => { store.audit.push({ action, userId, ip: meta.ip }); } },
    members: {
      findActiveMembership: async (userId, organizationId) => {
        const membership = store.memberships.find((row) => row.userId === userId && row.organizationId === organizationId && row.isActive);
        const user = store.users.find((row) => row.id === userId);
        return membership && user?.isActive ? { organizationId, roleId: membership.roleId } : undefined;
      },
      findActiveWorkspaces: async (userId) => store.workspaces.get(userId) ?? [],
    },
    permissions: { findScope: async (roleId, code) => (store.rolePermissions.get(roleId)?.has(code) ? 'all' : undefined) },
    platformRoles: { hasPlatformAccess: async (userId) => store.platformAdmins.has(userId) },
  };
  // A refresh token is "<familyId>.<secret>"; the family id names the session row.
  store.sessionFor = (refreshToken) => store.sessions.find((row) => row.familyId === refreshToken.split('.')[0]);
  return store;
}

// TypeORM's own repository providers need a database connection; the fakes above replace every class that uses
// them, so these only have to exist.
const ENTITIES = [User, OrganizationMember, UserRole, UserSession, AuditLog];

// A fresh app per test, so throttling counts never leak from one test into another.
// `controllers` adds fixture endpoints (e.g. a company endpoint) next to the real auth ones.
async function createAuthApp(t, store = createFakeStore(), { controllers = [] } = {}) {
  let builder = Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ENV] }), AuthModule],
    controllers,
  });
  for (const entity of ENTITIES) builder = builder.overrideProvider(getRepositoryToken(entity)).useValue({});
  const moduleRef = await builder
    .overrideProvider(UsersRepository).useValue(store.repositories.users)
    .overrideProvider(SessionsRepository).useValue(store.repositories.sessions)
    .overrideProvider(AuthAuditRepository).useValue(store.repositories.audit)
    .overrideProvider(OrganizationMembersRepository).useValue(store.repositories.members)
    .overrideProvider(PermissionsRepository).useValue(store.repositories.permissions)
    .overrideProvider(PlatformRolesRepository).useValue(store.repositories.platformRoles)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app, ORIGIN);
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector, app.get(JwtService)), app.get(RolesGuard));
  app.useGlobalInterceptors(new TenantContextInterceptor(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  t.after(() => app.close());
  return { server: app.getHttpServer(), store, jwt: app.get(JwtService) };
}

// Reads "transcend_refresh" from a response's Set-Cookie header.
function refreshCookie(response) {
  const header = (response.headers['set-cookie'] ?? []).find((cookie) => cookie.startsWith('transcend_refresh='));
  return header && { header, value: decodeURIComponent(header.split(';')[0].slice('transcend_refresh='.length)) };
}

module.exports = { ORIGIN, createAuthApp, createFakeStore, refreshCookie };
