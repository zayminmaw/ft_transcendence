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

Implemented: global validation/error handling, JWT verification, permission checks, active membership resolution, health endpoints, a 22-table baseline, session/header plumbing, module skeletons, and marketing pages. Business CRUD, login/refresh, organization discovery, role seeds, financial services, and record ownership policies remain to be implemented. The blueprint's WebSocket and proof-of-delivery features are planned; they are not current endpoints.

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
|   +-- components/              Shared daisyUI wrappers; Button, Input, Modal, Table
|   +-- hooks/                   Auth and active-organization hooks
|   +-- services/                Shared fetch client
|   +-- utils/                   Shared helper scaffold
|   +-- modules/
|   |   +-- marketing/           Public layout, landing/product/solutions/rollout pages
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
+-- scripts/                     Bash and PowerShell verification wrappers
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

Marketing components stay inside modules/marketing. Other modules consume only its index.ts public exports. Shared components use the CSS-first transcend daisyUI theme. Public forms do not imply a lead submission API. Workspace pages expose no business data in this scaffold; frontend route protection must accompany future authenticated features.

## 4. Tenant and authorization lifecycle

1. JwtAuthGuard verifies bearer signature, HS256 algorithm, expiration, issuer, audience, and a string user ID. Intentionally public endpoints skip this guard through explicit metadata.
2. RolesGuard requires permission metadata and a positive X-Organization-Id header. OrganizationMembersService checks active user, organization, and membership records; PermissionsRepository resolves the exact role permission.
3. RolesGuard attaches verified organization/role context. Guards precede interceptors in NestJS, so TenantContextInterceptor enforces the verified context rather than performing the first membership lookup.
4. Future domain repositories must add organization_id predicates to every query/mutation, and scope linked records to the same tenant. The current baseline has ordinary foreign keys; composite tenant constraints and scoped repository implementations are future work, not automatic protections already provided by TypeORM.
5. Assigned-only permissions are denied until resource ownership policies are implemented. There is no automatic wildcard bypass.

The frontend session store holds activeOrganizationId and an in-memory access token. The shared fetch client attaches X-Organization-Id and Authorization. Organization changes cancel/clear queries; new tenant query keys must include the organization ID. A 401 clears the session and cache.

## 5. Persistence and team integration

The versioned migration under backend/src/database/migrations is authoritative. The SQL document in .docs is a reference snapshot. All 22 baseline tables use InnoDB and utf8mb4_unicode_ci. Currency uses DECIMAL(12,2); package dimensions/capacity use DECIMAL(8,2); GPS coordinates retain their own precision. BIGINT IDs and decimal results remain strings.

Do not edit an already-applied baseline. Add a uniquely named/timestamped migration and coordinate migrations that affect the same tables. Ledger changes and balance updates must occur together in an ACID transaction. The current schema provides a merchant balance ledger; the blueprint's full double-entry accounting model is not yet implemented.

Keep domain work inside its module. App composition, router aggregation, the theme, shared components, dependency lockfiles, infrastructure, and schema migrations are shared integration surfaces. Coordinate those changes and review public contracts before consumers depend on them. See Git_Guide.md and the repository README for the team workflow.
