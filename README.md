# Transcend

Modular courier and last-mile logistics ERP. The scaffold provides public marketing pages, a workspace preview, domain boundaries, database migrations, and container orchestration. Login, refresh, and the documented roles and permissions are in the backend; the login screens, business CRUD, and financial operations are still to be implemented.

## Repository layout

```text
backend/                  NestJS / TypeORM / MariaDB
  src/common/             Validation, decorators, filters, tenant context, health
  src/database/           Connection, migrations, seeders
  src/modules/            auth, rbac, organizations, clients, staff,
                          drivers, assets, parcels, billing
frontend/                 React / Vite / Tailwind / daisyUI / TanStack Query
  src/app/                App, master routes, session and query stores
  src/global-components/  Shared UI used across application areas
  src/hooks/              Shared hooks
  src/services/           HTTP client with tenant and bearer headers
  src/utils/              Shared helpers
  src/modules/            Mirrored business modules and frontend-only marketing
                          with public index.ts exports
.docs/                    Tracked architecture, schema, standards, and Git workflow
docker/                   Compose manifests and development override
.husky/                   Git hooks; pre-push runs the verification gate
docker-compose.yml        Root entry point for the Docker manifests
```

Architecture and engineering documents live in [`.docs/`](.docs/). Environment files, dependencies, and build outputs are ignored. `npm run setup` installs a Husky pre-push hook that runs `npm run verify`.

See the [0.1.0 release notes](.docs/releases/0.1.0.md) for the initial scaffold's scope and validation.

This workspace already has ignored `.env` files with randomly generated local database passwords and a JWT secret. Its frontend uses http://localhost:8081 and MariaDB uses port 3307 because Windows blocks ports 8080 and 3306. The tracked example files retain the standard ports and contain placeholders only.

## Prerequisites

Use Node 24 LTS (see `.nvmrc`), npm, Docker, and Docker Compose 2.24.4 or newer. Separate lockfiles in each application allow independent `npm ci` and Docker build contexts; the root lockfile only pins Husky.

## How the scaffold fits together

The backend is a modular monolith: one NestJS process combines domain modules. Controllers will handle routing and DTO validation, services will implement business rules, and repositories will isolate database queries. The shared foundation already verifies JWTs, checks permissions and active organization membership, sanitizes errors, and exposes health endpoints. The business modules reserve DTO/entity folders for the next features; they do not yet expose business APIs.

The frontend mirrors the business domains so related work has a predictable home on both sides. Each module owns its pages, components, hooks, types, routes, and root `index.ts` public exports. The app combines module routes, while shared services attach session and organization headers. TanStack Query manages remote data caching; React Hook Form and Zod handle forms.

DaisyUI 5 is initialized through Tailwind CSS 4's CSS-first plugin in `frontend/src/styles.css`, following the [official Vite setup](https://daisyui.com/docs/install/vite/). The shared `transcend` theme maps the white, graphite, aqua, and lime palette from [DESIGN.md](DESIGN.md) to component styling, with local system font fallbacks. Use daisyUI semantic classes and the shared Button/Input wrappers, then Tailwind utilities for layout. Coordinate theme changes because both the website and workspace use them.

| Route | Current page |
| --- | --- |
| `/` | Landing page with delivery/settlement workflow preview |
| `/product` | Product blueprint and module overview |
| `/solutions` | Dispatch, courier, finance, and administration use cases |
| `/contact` | Validated browser-local operations brief and text download |
| `/app` | ERP workspace preview |
| `/app/parcels`, `/app/clients`, etc. | Business module placeholders |

The original module URLs, such as `/parcels`, still open their workspace pages. Marketing is isolated in `frontend/src/modules/marketing` and has its own layout. Its content describes the product blueprint; the brief form does not send email or submit a lead to an API.

The required product has three areas: a public website, an authenticated tenant portal, and a separate authenticated platform administration dashboard. Platform administrators will create, manage, activate/suspend, and monitor tenants; tenant administrators will manage their own organization's users, employees, roles, and permissions. A tenant is a courier organization, not a merchant/client record. The platform dashboard and portal authentication remain to be implemented, and privacy/terms pages are planned. See [the ERP specification](.docs/ERP-Logistics-System-Outline-v1.md#platform-administration-dashboard) for the dashboard requirements and access boundaries.

`.gitkeep` is only a placeholder for an empty folder: Git tracks files, so it would otherwise omit that directory from a clone. Remove it after adding the first real file in that folder. Formatting defaults to tabs displayed as 4 columns; YAML keeps two-space indentation because its syntax requires spaces. Existing files need not be reformatted as part of unrelated feature work.

## Working independently as a team

Use a separate clone and short-lived branch for each engineer. Keep work inside the relevant frontend/backend modules and agree public DTOs, response shapes, permission codes, and exports before one person's work depends on another's. An example split for five engineers is:

| Engineer | Area | Main folders |
| --- | --- | --- |
| 1 | Identity and tenant membership | Backend auth, rbac, organizations |
| 2 | Merchant accounts and public website | Frontend/backend clients; frontend marketing |
| 3 | Shipment and dispatch | Frontend/backend parcels |
| 4 | People and fleet | Frontend/backend staff, drivers, assets |
| 5 | Finance and settlement | Frontend/backend billing |

Adjust ownership per feature. This division reduces overlap, but shared files still need coordination: `app.module.ts`, `app/routes.tsx`, shared UI/hooks/services, `styles.css`, package manifests/lockfiles, Docker files, and migrations. Agree one owner for overlapping edits and integrate small changes promptly. Do not deep-import another frontend module's internals or reformat unrelated files to get around an integration issue.

After the initial snapshot is committed and shared, branch from updated `main` using `<type>/<scope>/<description>` (for example, `feat/fullstack/parcels-dispatch`). Rebase frequently, run `npm run verify`, and ask a teammate to review before merging. If dependencies conflict, resolve `package.json` first and regenerate the affected application's lockfile from its directory. Add uniquely named migrations for schema changes; never edit an already-applied baseline.

Each clone uses its own ignored `.env` files and local database. Separate worktrees are also possible after the initial commit. If several run on the same machine, use different Compose project names and host ports so containers and volumes do not overlap. Keep the standard/development commands for one checkout on the same project name. See [the Git guide](.docs/Git_Guide.md) for commands and review conventions.

## Run with Docker

Copy `.env.example` to `.env` and replace all password and JWT placeholders. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

```sh
docker compose up --build -d
docker compose ps
```

Open https://localhost (or http://localhost:8080, which automatically redirects to HTTPS). API liveness is http://localhost:3000/api/health and readiness is `/api/health/ready` (also accessible via https://localhost/api/health). NGINX serves SPA deep links and proxies `/api/` to NestJS. All published ports bind to localhost. This Compose configuration provides self-signed TLS for local development; internet deployment needs managed certificates and secrets.

MariaDB uses a named persistent volume. The one-shot `migrate` service applies the versioned baseline before the API starts. The baseline creates all 22 draft tables without dropping existing data, adds explicit foreign-key indexes, and uses `DECIMAL(12,2)` for currency and `DECIMAL(8,2)` for package dimensions/capacity. GPS coordinates retain their documented precision. Schema synchronization is disabled.

Apply the baseline to an empty database. MariaDB DDL commits implicitly; a failed baseline may leave partial tables and requires manual inspection before retrying. Automatic rollback of the baseline is disabled. The [SQL reference](.docs/maria-db-scheme-draft.sql) and [complete data dictionary](.docs/Data-Dictionary-and-Entity-Relationship-Reference.md) match the baseline. Future schema changes belong in new versioned migrations.

Stop with `docker compose down`; the database volume is retained.

## Development with hot reload

From the repository root:

```sh
npm run docker:dev
```

Open http://localhost:5173 (`/app` for the tenant workspace or `/platform` for platform administration). This switches the existing `transcend` stack to its development targets and retains the database volume. Source directories are mounted; frontend edits reload through Vite without restarting or rebuilding containers. The development override enables polling so edits from Windows reach the container's file watcher. Container dependencies remain isolated.

Run `npm run docker:dev` again after dependency or configuration changes. Return to the NGINX build with `npm run docker:up`; changes in that mode require rebuilding the frontend image, not just restarting its container. `npm run docker:down` stops either mode without deleting the database volume.

For host development, copy the backend and frontend `.env.example` files to `.env` in their respective directories if they do not already exist. Match database credentials and JWT secret with the root environment file, and set backend `DB_PORT` to the root `DB_PUBLIC_PORT`.

```sh
npm run setup
docker compose up -d mariadb
npm run migration:run --prefix backend
npm run dev:backend
# In a second terminal:
npm run dev:frontend
```

On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`. Host development requires dependencies installed by `npm run setup`.

## Accounts and demo data

There is no public sign-up. The migrations add the documented permissions and roles (`org_admin`, `dispatcher`, `hub_sorter`, `finance`, `hr_manager`, `fleet_lead`, `driver`, and `platform_admin` for platform access). To create the first platform administrator, run this once and answer the questions (the password is hidden):

```sh
docker compose exec -it backend npm run create-platform-admin
# Host development: npm run build --prefix backend && npm run create-platform-admin --prefix backend
```

It refuses a username or email that already exists and never changes an existing account. The password needs 8-128 characters with an upper-case letter, a lower-case letter, a number, and a symbol.

From then on, company admins (anyone whose role has `admin.manage_users`, `org_admin` by default) run their own people through `/api/members` with `X-Organization-Id`: list them, create an account (username, email, a first password, a role), deactivate or reactivate a membership, change its role (`PATCH /api/members/:userId` with `{ roleCode }`), and reset a forgotten password (the answer holds a one-time password to hand over). With `admin.manage_roles` they can also see what every role allows and how many people hold it (`GET /api/members/roles`, read-only: roles are shared by every company). A new or reset account must choose its own password at the next login with `POST /api/auth/password`; until then every other endpoint answers `403 AUTH_PASSWORD_CHANGE_REQUIRED`. In the app, these admins use **People & access** in the sidebar (`/app/<company>/rbac`), and a new or reset account is taken to `/change-password` right after logging in.

For development and evaluation, load the demo companies and accounts:

```sh
docker compose exec backend npm run seed:demo -- --force
# Host development: npm run seed:demo --prefix backend
```

`--force` is required in the production image because every demo account shares the password `Transcend-demo-1`. Never load demo data on a real deployment. Running it again adds only what is missing.

| Account | Access |
|---|---|
| `lina` | Tenant admin, Meridian Courier |
| `dana.saleh` | Dispatcher, Meridian Courier |
| `omar.hub`, `rania.finance`, `yusuf.hr`, `maya.fleet`, `samir.farah` | Hub Sorter, Finance, HR Manager, Fleet Lead, Driver at Meridian Courier |
| `karim.harbor` | Tenant admin, Harbor Express |
| `noor` | Dispatcher at Meridian Courier and Finance at Harbor Express |
| `zara.platform` | Platform admin, and Dispatcher at Meridian Courier |
| `platform.ops` | Platform admin only |
| `ex.member` | Inactive membership only (no workspace) |
| `new.hire` | Dispatcher at Meridian Courier, must choose a new password at the first login |

Log in with the username or the email (`<name>@meridian.example.test`, `@harbor.example.test`, or `@demo.example.test`). API clients such as curl or Postman must send `Origin` equal to `CORS_ORIGIN` (for example `-H 'Origin: https://localhost'`) on login, refresh, and logout; browsers do this on their own.

## Local quality gates

```sh
npm run format:check --prefix frontend
npm run verify
```

Prettier 3.9.10 is a pinned frontend development dependency installed by `npm run setup`. Run `npm run format --prefix frontend` to fix formatting, or `npm run format:check --prefix frontend` to check without editing. It reads `frontend/.prettierrc.json` and `.editorconfig`: tabs at width 4, single quotes in JavaScript/TypeScript, and a preferred frontend line width of 100. Dependencies, build outputs, local environment files, and the generated lockfile are excluded by `frontend/.prettierignore`.

A formatting check reports nonconforming files and exits with status 1. Formatting alone does not break runtime behavior or block commits/pushes automatically: `npm run verify` and the pre-push hook currently do not run Prettier. Run both checks above before sharing changes.

The Husky pre-push hook in `.husky/pre-push` runs `npm run verify` before every `git push` and blocks the push if it fails. `npm run setup` installs the hook; it needs the backend and frontend dependencies that setup also installs. There is no remote CI, so the hook is a local check and `git push --no-verify` skips it.

Verification builds and lints both apps and tests the HTTP security boundary and error sanitization. `npm run test:db --prefix backend` additionally runs the database tests: it recreates `<DB_NAME>_test` in the running MariaDB (it needs `DB_ROOT_PASSWORD` from the root `.env`), applies all migrations, and checks the SQL queries, sessions, demo data, and the first-admin command. It is not part of `verify`, so pushing never needs a database. Lint never edits source files. Before adding business endpoints, add meaningful domain tests.

## Engineering rules

- Controllers route and validate DTOs; services contain domain logic; repositories use the TypeORM entities in each module's `entities/` folder, with parameterized raw SQL only where the ORM can't express a query; migrations, not entities, change the schema. Use class-validator DTOs with the global validation pipe.
- Endpoints are protected globally by JWT and permission guards. Every endpoint declares exactly one of: `@RequirePermission('module.action')` for company data (it needs `X-Organization-Id` and an active membership whose role has that permission); `@Authenticated()` for the logged-in account itself, with no company (like `GET /api/auth/me`); `@PlatformAdmin()` for platform endpoints (only the `platform_admin` role in `user_roles` counts, and the company header is ignored); or `@Public()` for intentional public endpoints. An endpoint with none of them is refused. JWTs require a string user ID, expiration, issuer, audience, and HS256 signature. Active organization membership and account status are checked against the database.
- Requests use `X-Organization-Id`. Because Nest guards precede interceptors, the permission guard resolves membership; the tenant interceptor enforces the verified context. New repositories must scope every query and mutation by the verified organization ID and validate all referenced records against that tenant. Add composite tenant foreign keys when introducing domain entities. No business data endpoints are enabled by this scaffold.
- `assigned_only` permissions are denied until a resource ownership policy is implemented. No wildcard super-admin bypass or default account is created.
- Frontend modules expose their public interface through root `index.ts`; ESLint rejects cross-module deep imports. Shared UI belongs in `src/global-components`, imported through `@global-components`, and module-specific UI belongs in the module.
- Use React Hook Form with Zod for forms. Show field errors and disable mutating buttons while submitting. Include the organization ID in tenant query keys; cancel and clear queries on organization changes.
- Keep access tokens in memory. The HTTP client supplies authorization/tenant headers and clears session/cache on unauthorized responses. The refresh token lives only in an httpOnly cookie scoped to `/api/auth`. The login screens, organization discovery in the frontend, and permission-aware navigation are subsequent features; initial module pages contain no operational data.
- Currency remains decimal strings at the database boundary. Never use floating-point arithmetic for money. Ledger entries and balance changes must execute together in an ACID transaction; do not mutate balances independently.

Use short-lived branches named `<type>/<scope>/<description>` and Conventional Commit messages. Run verification and obtain review before merging. Release 0.1.0 establishes the shared initial scaffold.
