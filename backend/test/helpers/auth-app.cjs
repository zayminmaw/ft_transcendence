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
const { AuditLog } = require('../../dist/modules/audit/entities/audit-log.entity');
const { AuditService } = require('../../dist/modules/audit/audit.service');
const { AuditRepository } = require('../../dist/modules/audit/audit.repository');
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
const { createAccount } = require('../../dist/modules/users/accounts');
const { MembersAuditRepository } = require('../../dist/modules/members/members-audit.repository');
const { MembersRepository } = require('../../dist/modules/members/members.repository');

const ORIGIN = 'http://localhost:5173';
const ENV = { JWT_SECRET: 'test-secret-with-at-least-32-characters', JWT_ISSUER: 'transcend', JWT_AUDIENCE: 'transcend-web', CORS_ORIGIN: ORIGIN };

function auditInScope(scope, row) {
  if (scope.kind === 'tenant') return row.organizationId === scope.organizationId;
  if (scope.kind === 'actor') return row.userId === scope.userId;
  return true;
}

// In-memory stand-ins for the SQL repositories: same method names and return shapes. test:db checks the real SQL.
function createFakeStore() {
  const store = {
    users: [], sessions: [], audit: [], auditEntries: [], auditRows: [], workspaces: new Map(), platformAdmins: new Set(), lastLogins: [],
    // Company access for the guard: memberships ({ organizationId, userId, roleId, isActive }) and each role's codes.
    memberships: [], rolePermissions: new Map(),
    // Roles for the people list and the roles you may give: { id, code, name, description }.
    roles: [],
  };
  let nextSessionId = 1;
  let nextUserId = 100;
  const sameText = (a, b) => a.toLowerCase() === b.toLowerCase();
  const sessionRecord = (row) => row && {
    id: row.id, userId: row.userId, idleExpiresAt: row.idleExpiresAt, absoluteExpiresAt: row.absoluteExpiresAt, revokedAt: row.revokedAt,
  };
  const lockedSession = (row) => row && {
    ...sessionRecord(row), familyId: row.familyId, tokenHash: row.tokenHash,
    previousTokenHash: row.previousTokenHash ?? null, rotatedAt: row.rotatedAt ?? null,
  };
  // The same shape MembersRepository returns: account, role and membership of one company, sorted by username.
  const memberRows = (organizationId) => store.memberships
    .filter((row) => row.organizationId === organizationId)
    .map((row) => {
      const user = store.users.find((candidate) => candidate.id === row.userId);
      const role = store.roles.find((candidate) => String(candidate.id) === row.roleId);
      return {
        userId: user.id, username: user.username, email: user.email, role: { id: role.id, code: role.code, name: role.name },
        isActive: row.isActive, lastLoginAt: user.lastLoginAt ?? null, mustChangePassword: user.mustChangePassword === true,
      };
    })
    .sort((a, b) => a.username.localeCompare(b.username));
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
    companyMembers: {
      // Every company role except platform_admin, sorted by name like the real query.
      companyRoles: async () => store.roles
        .filter((role) => role.code !== 'platform_admin')
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ id, code, name, description }) => ({ id, code, name, description })),
      list: async (organizationId) => memberRows(organizationId),
      find: async (organizationId, userId) => memberRows(organizationId).find((member) => member.userId === userId),
      // The real createAccount (its rules and messages), on an in-memory "manager".
      create: async (organizationId, input) => {
        const manager = {
          existsBy: async (_entity, conditions) => conditions.some((condition) => store.users.some((user) =>
            (condition.username && sameText(user.username, condition.username)) || (condition.email && sameText(user.email, condition.email)))),
          create: (_entity, values) => ({ ...values }),
          save: async (row) => {
            const user = { id: String(nextUserId++), isActive: true, lastLoginAt: null, ...row };
            store.users.push(user);
            return user;
          },
        };
        const userId = await createAccount(manager, { username: input.username, email: input.email, password: input.password, mustChangePassword: true });
        store.memberships.push({ organizationId, userId, roleId: String(input.roleId), isActive: true });
        return memberRows(organizationId).find((member) => member.userId === userId);
      },
      setActive: async (organizationId, userId, isActive) => {
        Object.assign(store.memberships.find((row) => row.organizationId === organizationId && row.userId === userId), { isActive });
      },
      belongsElsewhere: async (organizationId, userId) =>
        store.memberships.some((row) => row.userId === userId && row.organizationId !== organizationId) || store.platformAdmins.has(userId),
    },
    membersAudit: { record: async (action, entry) => { store.audit.push({ action, ...entry }); } },
    // The shared writer, for code that calls it directly (e.g. the audit read endpoints). test:db covers the SQL.
    auditService: {
      record: async (_manager, entry) => { store.auditEntries.push(entry); },
      recordStandalone: async (entry) => { store.auditEntries.push(entry); },
      subscribe: () => () => {},
    },
    // Stored audit rows ({ id, organizationId, userId, resourceType, recordId, category, ... }) behind the read API.
    auditRepository: {
      list: async (scope, query) => {
        const ids = query.recordId?.split(',');
        const showAccess = query.module === 'audit' || query.resourceType === 'audit_log';
        const rows = store.auditRows.filter((row) => auditInScope(scope, row)
          && (showAccess || row.category !== 'access')
          && (!query.module || row.module === query.module)
          && (!query.resourceType || row.resourceType === query.resourceType)
          && (!ids || ids.includes(row.recordId))
          && (!query.action || row.action === query.action)
          && (!query.userId || row.userId === query.userId));
        const start = (query.page - 1) * query.pageSize;
        return { items: rows.slice(start, start + query.pageSize), total: rows.length, page: query.page, pageSize: query.pageSize };
      },
      find: async (scope, id) => store.auditRows.find((row) => row.id === id && auditInScope(scope, row)) ?? null,
      isActiveMember: async (userId, organizationId) => store.memberships.some((row) => row.userId === userId
        && row.organizationId === organizationId && row.isActive),
    },
  };
  // A refresh token is "<familyId>.<secret>"; the family id names the session row.
  store.sessionFor = (refreshToken) => store.sessions.find((row) => row.familyId === refreshToken.split('.')[0]);
  return store;
}

// TypeORM's own repository providers need a database connection; the fakes above replace every class that uses
// them, so these only have to exist.
const ENTITIES = [User, OrganizationMember, UserRole, UserSession, AuditLog];

// A fresh app per test, so throttling counts never leak from one test into another.
// `controllers` adds fixture endpoints (e.g. a company endpoint) next to the real auth ones; `imports` adds modules
// (e.g. MembersModule), whose repositories are replaced by the fakes above.
async function createAuthApp(t, store = createFakeStore(), { controllers = [], imports = [] } = {}) {
  let builder = Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ENV] }), AuthModule, ...imports],
    controllers,
  });
  for (const entity of ENTITIES) builder = builder.overrideProvider(getRepositoryToken(entity)).useValue({});
  const moduleRef = await builder
    .overrideProvider(UsersRepository).useValue(store.repositories.users)
    .overrideProvider(SessionsRepository).useValue(store.repositories.sessions)
    .overrideProvider(AuthAuditRepository).useValue(store.repositories.audit)
    .overrideProvider(AuditService).useValue(store.repositories.auditService)
    .overrideProvider(AuditRepository).useValue(store.repositories.auditRepository)
    .overrideProvider(OrganizationMembersRepository).useValue(store.repositories.members)
    .overrideProvider(PermissionsRepository).useValue(store.repositories.permissions)
    .overrideProvider(PlatformRolesRepository).useValue(store.repositories.platformRoles)
    .overrideProvider(MembersRepository).useValue(store.repositories.companyMembers)
    .overrideProvider(MembersAuditRepository).useValue(store.repositories.membersAudit)
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
