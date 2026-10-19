# System Technical Architecture & Design

## 1. Stack and implementation status

Transcend is a multi-tenant modular monolith for courier operations and last-mile logistics. The current repository is a foundation for the planned ERP, with public marketing pages and an operational workspace preview.

| Layer | Current selection | Purpose |
| --- | --- | --- |
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS 4, daisyUI 5 | Public pages, workspace shell, shared themed UI |
| Client data | TanStack Query, fetch, in-memory session store | API requests, cache, active organization context |
| Forms | React Hook Form and Zod | Typed validation and submitting state |
| Backend | NestJS 11, Node 24 LTS, TypeScript | Modular domain foundation and HTTP security |
| Persistence | TypeORM, mysql2, MariaDB 10.11 / InnoDB | Versioned SQL schema, decimal precision, ACID transactions |
| Infrastructure | Docker Compose, multi-stage Dockerfiles, NGINX 1.28 | Development and standard container stacks |

Implemented: global validation/error handling, JWT verification, permission checks, active membership resolution, health endpoints, a 22-table baseline, session/header plumbing, module skeletons, and marketing pages. The backend also provides login, refresh, and logout with rotating refresh-token sessions in an httpOnly cookie, `GET /api/auth/me` (user, active workspaces, platform access), `@Authenticated()` account-only endpoints, the documented roles and permissions, a first-platform-administrator command, and a demo seed. Business CRUD, the login screens and authenticated frontend routing, financial services, and record ownership policies remain to be implemented. An authenticated, tenant-scoped notification socket exists (see section 4); domain events that use it and proof-of-delivery features are planned.

Confirmed requirements also include a platform administration dashboard for creating, managing, activating/suspending, and monitoring tenants, and an authenticated tenant portal with organization-scoped user/employee/role management. The platform tenant-management API is implemented (see [Platform tenant management](#platform-tenant-management)); tenant activity monitoring is not. Portal route authentication is not implemented. Public privacy and terms-of-service pages remain planned.

## 2. Directory standard

Both applications mirror organizations, clients, staff, drivers, assets, parcels, billing, and rbac. Auth currently exists on the backend. Marketing is intentionally frontend-only.

```text
transcend/
+-- .docs/                       Tracked architecture, schema, standards, and workflow
+-- frontend/src/
|   +-- app/
|   |   +-- App.tsx              Workspace layout
|   |   +-- routes.tsx           Router composition and compatibility routes
|   |   +-- store/               Session and query client
|   +-- global-components/       Shared daisyUI wrappers, dashboard layout, and sidebar
|   +-- hooks/                   Auth and active-organization hooks
|   +-- services/                Shared fetch client
|   +-- utils/                   Shared helper scaffold
|   +-- modules/
|   |   +-- marketing/           Public layout, landing/product/solutions/rollout pages
|   |   +-- platform/            Platform administration layout and empty management pages
|   |   +-- organizations/
|   |   +-- clients/
|   |   +-- staff/
|   |   +-- drivers/
|   |   +-- assets/
|   |   +-- parcels/
|   |   +-- billing/
|   |   +-- rbac/
|   +-- styles.css               Tailwind/daisyUI plugin and shared theme
|   +-- main.tsx
+-- backend/src/
|   +-- common/                  Configuration, decorators, filters, health, tenant context
|   +-- database/                Connection, migrations, seeders
|   +-- modules/                 Auth and the mirrored business domains
|   +-- app.module.ts            Module composition and global providers
|   +-- main.ts                  HTTP startup and global validation
+-- docker/                      Compose manifests and development override
+-- docker-compose.yml           Root Compose entry point
+-- .husky/                      Git hooks; pre-push runs npm run verify
```

Frontend domain folders contain components, pages, hooks, types, routes.tsx, and a public index.ts. Parcels also has a module-local utils folder. Backend domain folders reserve dto and entities, with controllers/services/repositories added as implemented. Empty folders use .gitkeep until their first real file is added.

## 3. Public routes and workspace

| Route | Purpose |
| --- | --- |
| / | Landing page |
| /product | Product blueprint and workflow preview |
| /solutions | Team responsibilities and use cases |
| /contact | Browser-local rollout brief form and text download |
| /app | Workspace preview |
| /app/organizations, /app/clients, etc. | Mirrored business module pages |
| /organizations, /clients, etc. | Original workspace routes retained for compatibility |
| /api/health | Public API liveness |
| /api/health/ready | Public database/schema readiness |

Marketing components stay inside modules/marketing. Other modules consume only its index.ts public exports. Shared components live in `global-components`, are imported through `@global-components`, and use the CSS-first transcend daisyUI theme. Public forms do not imply a lead submission API. Workspace pages expose no business data in this scaffold; frontend route protection must accompany future authenticated features.

### Required application areas (planned)

| Area | Audience and access | Required behavior |
| --- | --- | --- |
| Public website | Unauthenticated visitors | Marketing, contact, privacy, and terms-of-service pages |
| Tenant portal | Authenticated users with active organization membership | Courier/accounting workflows and tenant administrators managing their own users, employees, roles, and permissions |
| Platform dashboard | Authenticated platform administrators with explicit platform permissions | Create/manage tenants, activate/suspend them, assign tenant administrators, and monitor tenant status/activity |

The existing `/app` will become the tenant portal. The platform dashboard has its own frontend routes and `@PlatformAdmin()` API routes under `/api/platform`. The `organizations` workspace placeholder is not a completed platform dashboard. Preserve tenant checks on compatibility URLs when authenticated workflows are introduced.

### Dashboard layout scaffold

The frontend provides separate, public layout previews for the tenant workspace (`/app`) and platform administration (`/platform`). Both use a shared responsive dashboard shell, with area-specific sidebars and empty pages. They perform no business reads or mutations and do not implement authentication or grant platform access yet.

- Tenant pages: `/app`, `/app/parcels`, `/app/billing`, `/app/rbac`, `/app/clients`, `/app/staff`, `/app/drivers`, `/app/assets`, and `/app/organizations` (settings for the current tenant).
- Platform pages: `/platform/tenants`, `/platform/activity`, `/platform/tenants/new`, `/platform/tenants/:tenantId`, and `/platform/tenants/:tenantId/administrators`. `/platform` redirects to the tenant directory.
- Original module URLs redirect to their `/app` counterparts so future tenant route protection has one canonical entry point.

Platform frontend compositions live in `modules/platform` and are exported through its root `index.ts`. The tenant pages use the platform tenant-management API; `/platform/activity` still shows sample data.

Tenant sidebar configuration lives in `app/navigation.ts`, alongside app route composition. Operations groups overview, parcels/dispatch, clients/merchants, drivers, and fleet/assets. Administration groups billing/COD, staff, access control (users/roles/permissions), and organization settings. All eight domain modules remain reachable; platform tenant management stays in its separate sidebar. These groups organize work and do not imply administrative roles or grant permissions. Future authentication must add verified-session navigation visibility and independent route/API authorization.

## 4. Tenant and authorization lifecycle

1. JwtAuthGuard verifies bearer signature, HS256 algorithm, expiration, issuer, audience, and a string user ID. Intentionally public endpoints skip this guard through explicit metadata.
2. RolesGuard requires permission metadata and a positive X-Organization-Id header. OrganizationMembersService checks active user, organization, and membership records; PermissionsRepository resolves the exact role permission.
3. RolesGuard attaches verified organization/role context. Guards precede interceptors in NestJS, so TenantContextInterceptor enforces the verified context rather than performing the first membership lookup.
4. Future domain repositories must add organization_id predicates to every query/mutation, and scope linked records to the same tenant. The current baseline has ordinary foreign keys; composite tenant constraints and scoped repository implementations are future work, not automatic protections already provided by TypeORM.
5. Assigned-only permissions are denied until resource ownership policies are implemented. There is no automatic wildcard bypass.

The frontend session store holds activeOrganizationId and an in-memory access token. The shared fetch client attaches X-Organization-Id and Authorization. Organization changes currently cancel/clear queries; tenant query keys must include the verified organization ID and an identity/session boundary. A 401 clears the session and cache. These hooks do not yet provide the complete workspace-picker and application-state isolation contract described below.

### Platform authorization boundary (planned)

Platform endpoints must verify a platform role and exact permission independently of tenant membership. Tenant permissions and `X-Organization-Id` must never confer platform authority. Tenant administrators cannot create other tenants, assign platform roles, or access another tenant's records. Platform tenant-management permission alone must not grant operational/financial data access.

Platform mutations and monitoring access require audit records identifying the actor, target tenant, action, and outcome. Suspended tenants must be denied tenant-portal/API access while authorized platform administrators retain access to their tenant management records. Implement this through a dedicated platform policy and reviewed APIs; the existing membership guards are not an implemented platform authorization mechanism.

### Platform tenant management

`modules/platform` serves the tenant pages. Every route needs `@PlatformAdmin()`; tenant roles and `X-Organization-Id` never open them. Each change writes an `audit_logs` row (module `platform`) in the same transaction, never with credentials.

| Route | Purpose |
| --- | --- |
| `GET /api/platform/tenants` | Search, status filter, sort and paging, with total/active/suspended counts |
| `POST /api/platform/tenants` | Company, first administrator account and `org_admin` membership in one transaction |
| `GET`/`PATCH /api/platform/tenants/:id` | Details with administrators and member counts; edit name and contact details (the slug is fixed) |
| `POST /api/platform/tenants/:id/suspend`, `…/reactivate` | Flip `is_active`; suspending needs a reason |
| `GET /api/platform/tenants/:id/members` | Active members who could become administrators |
| `GET /api/platform/tenants/:tenantId/member-roles` | Roles a revoked administrator can move to in that company: every role in the database except `org_admin` and `platform_admin` |
| `POST /api/platform/tenants/:id/administrators` | Assign a new account, or change an existing member's role to `org_admin` |
| `POST /api/platform/tenants/:id/administrators/:userId/revoke` | Revoke with a reason and a chosen outcome |

A membership is one role in one company, so assigning and revoking change that membership. Revoking an administrator either moves them to another company role (`change_role`) or deactivates their membership (`remove`). Revoking the **last** administrator who can still sign in instead deactivates their membership and suspends the tenant (`suspend_tenant`), with the revoke reason as the suspension reason. The API refuses an outcome that does not match the current count (`LAST_ADMINISTRATOR`, `NOT_LAST_ADMINISTRATOR`), so a stale page never causes an unexpected suspension. A tenant without such an administrator cannot be reactivated (`TENANT_HAS_NO_ADMINISTRATOR`); administrators can be assigned while it is suspended. Status and administrator changes lock the company row first, so concurrent revokes cannot leave an active tenant without an administrator.

### Tenant onboarding and login contract (planned)

Tenant creation must transactionally provision the organization, its first administrator account, and an active `org_admin` membership. An authorized platform administrator supplies both organization and administrator details; onboarding fails as a whole if any required record cannot be created. Initial tenant-administrator permissions must allow company account creation without granting global platform authority.

There is no public signup. After the first administrator signs in and selects their company, `admin.manage_users` permits creating additional accounts and allowed memberships only within the verified tenant. Those users sign in through the shared proposed `/login` page. After authentication, company users choose a workspace from their server-verified active memberships before entering `/app`; a single-company account sees its one available company. An authenticated membership-discovery service must work before active-company selection. Platform-only accounts authenticate without a tenant and require a separate platform permission check before entering `/platform`; platform access is not a company membership.

Account-only requests require an explicit authentication-only policy that retains JWT and active-user checks. Introducing `@Authenticated()` requires coordinated changes to the permission guard and `TenantContextInterceptor`; it must not disable membership/permission checks for tenant routes or turn missing authorization metadata into allowed access. Login and this policy (`@Authenticated()`) are implemented; account provisioning and authenticated frontend routing remain unimplemented.

See [Tenant onboarding and login flow](Tenant-Onboarding-and-Login-Flow.md) for the full journey, secure credential handover, transactional failure behavior, and acceptance requirements.

### Workspace switching and company isolation (required, not implemented)

The company workspace picker is an agreed product requirement, with an in-session switcher for authorized companies. Keep the existing Figma chooser as its design starting point. Resolve and revalidate the selected membership on the server; remembered company IDs and client headers are not authorization.

On each switch, stop tenant rendering/requests, cancel and clear outgoing queries, verify the destination membership, reset company-specific stores, roles/permissions, forms, drafts, selections, and navigation, then fetch the destination data. Tenant cache keys and any persisted private state must be scoped to identity/session and organization, with platform data separately scoped. Never display previous-company data as a loading fallback. Capture the organization and session generation on requests and writes; late results, optimistic rollbacks, and notifications from the old company must not update the new workspace. Clearing a cache does not cancel a server write that has already started.

Future subscriptions must leave old company channels and reject stale events. Browser persistence, service-worker/shared caches, cross-tab coordination, logout/account changes, and membership revocation must preserve the same isolation. Server queries and mutations independently enforce tenant scope. See the [detailed cache/state requirements and acceptance checks](Tenant-Onboarding-and-Login-Flow.md#prevent-cache-and-state-leakage-between-companies); existing query cancellation alone is not proof that company data cannot leak.

### Company contacts and online status (required, not implemented)

Tenant roles determine which company members a user may add as contacts. Enforce an explicit acting-role → target-role matrix when listing eligible candidates and creating relationships, and group contacts by tenant role. HR/employee roles, Dispatcher → Driver/Dispatcher, and Driver → Dispatcher are intended examples. Departments are optional labels/filters and do not determine add eligibility. Exact role pairings, add permissions, and seeds still need implementation contracts.

Adding a contact requires both users to be active in the same active company. A valid saved contact includes status access without an additional role-based presence permission; authenticate the viewer and verify active company access, relationship ownership, and target company membership on status reads/subscriptions. Role changes affect future additions and grouping, not independent access to existing saved-contact status. Contact removal or loss of company access ends status access. Do not broadcast all company statuses and filter them only in the UI.

The only contact statuses are Online, Offline, and Suspended. Account or company-membership suspension takes precedence over live connections/cached presence; keep existing suspended contacts visible as Suspended while blocking their company access and new additions. Otherwise derive Online/Offline from expiring authorized connections aggregated across tabs/devices in the selected company. Loading/error indicators are not additional status values. Driver duty status and `last_login_at` remain separate.

Persist company-scoped contact relationships through new migrations; suspension semantics and transient live presence need explicit implementation contracts. Scope contact queries and presence maps to identity/session and company, leave old subscriptions on switching/logout, and ignore delayed responses/events. See [Company contacts and online status](Contacts-and-Online-Status.md) for the required behavior and isolation checks. APIs, schema additions, policies, and real-time/frontend features remain unimplemented.

### Real-time notifications (foundation implemented)

The Socket.IO gateway in `backend/src/modules/notifications` authenticates every handshake before connecting: the client sends `auth: { token, organizationId }`, the server verifies the token with the same claims as `JwtAuthGuard` and requires an active membership in that organization. Rejected handshakes receive a generic `Unauthorized` error and never join a room. Each socket serves one verified company and joins `org:<id>` and `org:<id>:user:<id>`; switching company or session opens a new socket, which leaves the old rooms. The gateway uses `CORS_ORIGIN`, not a wildcard.

`EventsGateway.sendNotification(target, event)` has no broadcast path. Senders must name the organization and the permission a recipient needs, and may name one user. Delivery requires that permission with `all` scope, matching `RolesGuard`. Payloads include `organizationId`, and the frontend `useWebSocket` hook ignores events for any other company. Expired tokens and revoked memberships do not yet disconnect an open socket; that lifecycle needs an implementation contract.

## 5. Persistence and team integration

The versioned migration under backend/src/database/migrations is authoritative. The SQL document in .docs is a reference snapshot. All 22 baseline tables use InnoDB and utf8mb4_unicode_ci. Currency uses DECIMAL(12,2); package dimensions/capacity use DECIMAL(8,2); GPS coordinates retain their own precision. BIGINT IDs and decimal results remain strings.

Do not edit an already-applied baseline. Add a uniquely named/timestamped migration and coordinate migrations that affect the same tables. Ledger changes and balance updates must occur together in an ACID transaction. The current schema provides a merchant balance ledger; the blueprint's full double-entry accounting model is not yet implemented.

Keep domain work inside its module. App composition, router aggregation, the theme, shared components, dependency lockfiles, infrastructure, and schema migrations are shared integration surfaces. Coordinate those changes and review public contracts before consumers depend on them. See Git_Guide.md and the repository README for the team workflow.
