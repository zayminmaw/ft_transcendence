# Coding Standards & Engineering Best Practices

These standards apply to the current scaffold and future domain implementation. Repository instructions and design references live in tracked `.docs/`.

## Formatting

Use tabs with a display width of 4, as defined by `.editorconfig`. YAML uses two spaces because YAML does not permit tab indentation. Avoid reformatting unrelated files in a feature change. `.gitkeep` preserves an otherwise empty directory; remove it when adding the first real file there.

Prettier 3.9.10 is a pinned frontend development dependency installed by `npm run setup`. `frontend/.prettierrc.json` sets single quotes; `.editorconfig` supplies tabs, width 4, LF endings, and a preferred frontend line width of 100. Keep JSX sections, nested expressions, and CSS blocks readable across multiple lines. `frontend/.prettierignore` excludes dependencies, generated files, and local environments.

From the repository root:

```sh
npm run format --prefix frontend       # Fix formatting
npm run format:check --prefix frontend # Check without editing
```

The check exits with status 1 and lists files that need formatting. It is separate from ESLint, `npm run verify`, and the Husky pre-push hook; formatting violations alone currently do not block commits or pushes. Run it before sharing changes.

## 1. NestJS Backend Guidelines

### Controller-Service-Repository Segregation

* **Controllers** are thin: they handle HTTP routing, validate request payloads via `ValidationPipe`, invoke services, and return DTO responses. No database queries or calculations in controllers.
* **Services** contain all domain logic. When financial balances or multiple DB operations occur (e.g., marking a parcel delivered + updating driver COD balance), wrap inside a **database transaction** (`QueryRunner` / transactional manager).
* **Guards & RBAC:** JWT and permission guards are registered globally. Every protected endpoint declares `@RequirePermission(...)`; endpoints without permission metadata are denied. Only intentionally public endpoints use `@Public()`. Do not reapply global guards at controller level:
```typescript
@RequirePermission('parcels.dispatch')
@Post(':id/assign')
async assignDriver(@Param('id') id: string, @Body() dto: AssignDriverDto) {
  return this.parcelsService.assignToDriver(id, dto);
}

```

* **Tenant context:** Nest guards run before interceptors. `RolesGuard` validates `X-Organization-Id`, active user/organization membership, and the required role permission before attaching the tenant context. `TenantContextInterceptor` enforces that this verified context exists. Domain repositories must scope all reads and writes to it and validate the tenant of referenced records. An index or ordinary foreign key alone does not enforce tenant isolation.
* **Assigned-only access:** The scaffold denies `assigned_only` permissions until resource ownership policies exist. Migrations install the documented roles and permissions, but no accounts or wildcard administrator bypass. The first platform administrator comes from `npm run create-platform-admin`; demo accounts come only from `npm run seed:demo`.
* **Platform versus tenant access:** The required platform administration dashboard needs a dedicated platform authorization policy. Tenant administrators may manage membership, employees, roles, and permissions only within their own organization; they cannot grant platform roles or access other tenants. Platform tenant-management actions must use explicit permissions and audit records, rather than bypassing tenant guards. These platform services are planned, not implemented.
* **Provisioning and login (planned):** No public signup. Platform tenant creation must create the organization, its first administrator account, and active tenant-admin membership in one transaction. Additional account creation requires `admin.manage_users` in the verified tenant and must prevent role escalation. Users sign in through the shared proposed `/login` page. Never expose plaintext passwords in logs, audit events, or confirmations. See [Tenant onboarding and login flow](Tenant-Onboarding-and-Login-Flow.md).
* **Account-only authorization (planned):** If adding an explicit `@Authenticated()` policy for endpoints without company context, retain JWT and active-user verification and coordinate both the permission guard and `TenantContextInterceptor`. Existing tenant endpoints still require membership and exact permissions; missing authorization metadata remains denied. Platform endpoints need their independent platform policy.
* **Contacts and presence (planned):** Control eligible candidates and new additions with a server-enforced acting-role → target-role matrix and active same-company accounts/memberships. Group by tenant role; departments are optional labels/filters. An added contact includes status access without a separate role-based presence permission; verify the viewer's active company access, contact ownership, and same-company relationship. Role changes alone do not hide existing saved-contact status. Use exactly Online, Offline, and Suspended, with target suspension overriding live presence while retaining existing contact visibility. Block suspended users' access/new additions and end status access when the relationship/company access is removed. Keep driver duty status separate, expire stale connections, and isolate company caches/subscriptions. See [Company contacts and online status](Contacts-and-Online-Status.md).



### Defensive Error Handling

* Throw native NestJS `HttpException` instances (`NotFoundException`, `ConflictException`, `BadRequestException`).
* Never leak raw database error strings to the client. A global `HttpExceptionFilter` intercepts SQL errors (e.g., MariaDB error code `1062` duplicate entry) and outputs clean, actionable JSON payloads.

### Technical Logging

* Technical logs (errors, latency, lifecycle) and the audit trail (who changed what) are separate. Do not use logs as an audit record.
* Log through Nest's `Logger` (`new Logger(MyService.name)`), never `console.*`. Never log request bodies, headers, or whole entities.
* Every request gets an `X-Request-Id`. An incoming id of 8-64 letters, digits, or dashes is kept, so traces can cross the proxy; otherwise a UUID is generated. The id is echoed in the response and is available anywhere in the request through `currentRequestId()` (`common/context/request-context.ts`).

### Audit Trail

The audit trail records every create, update, and delete, plus security events: who did it, when, from where, and what changed. It lives in `audit_logs`, which is append-only. Triggers reject every update, and reject any delete before the row's `retain_until`.

* **Write through `AuditService` only** (`modules/audit`). Import `AuditModule`. The service fills in the actor (id, plus the username and role at that moment), the IP address, the user agent, `requestId`, the source, and the retention.

  Record a change inside the same transaction, so the change and its row are saved together or not at all:

  ```ts
  await this.audit.record(manager, {
  	module: 'billing', action: 'status_change',
  	resourceType: 'invoice', recordId: invoice.id, resourceLabel: invoice.number,
  	organizationId: tenant.organizationId, before, after,
  });
  ```

  Use `audit.recordStandalone({...})` only when there is no business transaction (failed logins, reads, denials). Plain functions that already hold a transaction manager can call `recordAudit(manager, {...})`.
* **Use a shared verb as the action**: `create`, `update`, `delete`, `status_change`, `transfer`, `assign`, or `revoke`. Name the entity in `resourceType`. If none fits, add a verb to `AUDIT_ACTIONS` rather than inventing a one-off name.
* **Declare what may be stored.** Add your resource to `AUDIT_RESOURCES` (`modules/audit/audit-resources.ts`), listing only the fields people need in the history. Values are stored as they are, because a company sees all of its own data. Each field's rule says how it is shown to platform administrators: `plain`, or for personal data (people's emails, phones, national ids) `maskEmail`, `maskPhone`, or `redact`. Unlisted fields are dropped. Keys that look like passwords, tokens, secrets, cookies, or sessions can never be listed or stored.
* **Pass entity snapshots** as `before` and `after`, never DTOs or request bodies. An `update` stores only the fields that changed. Other actions keep the whole allowlisted snapshot, for context.
* **Keep `resourceLabel` and `params` free of personal data.** They are shown as they are, and the frontend translates the sentence from the action, the resource, and `params`. Store no English descriptions.
* **Reading the trail** (`GET /api/audit-logs`) needs `admin.audit_logs` and is scoped to the company. The same endpoint serves one record's history (`?resourceType=invoice&recordId=17`). `GET /api/audit-logs/mine` lists your own actions. `GET /api/platform/audit-logs` is for platform administrators, and it hides the values of company business data. Every read is audited, and so is every refused attempt.
* **For alerts and notifications**, subscribe with `audit.subscribe(listener)`. Listeners hear only about committed rows.


---

## 2. React Vite Frontend Guidelines

### UI Foundation

* Use React 19, Vite 7, Tailwind CSS 4, and daisyUI 5. The CSS-first daisyUI plugin and the `transcend` theme are configured in `frontend/src/styles.css`; no Tailwind v3 configuration file is needed.
* Use daisyUI semantic classes (`btn`, `input`, `select`, `card`, `badge`) and theme colors (`bg-base-100`, `text-base-content`, `btn-primary`) for shared UI. Use Tailwind utilities for layout and spacing. Extend existing shared components before introducing competing button or field styles.
* Theme changes and shared component changes affect the whole frontend; coordinate their ownership with the team.
* `DESIGN.md` at the repository root supplies the visual reference. The daisyUI theme uses white/cloud surfaces, graphite/ink text, aqua conversion controls, and a lime announcement strip. Use the documented local font fallbacks until licensed font assets are supplied; do not add a remote font dependency silently.
* Public marketing pages live in `modules/marketing` with their own layout. The workspace is under `/app`; the original module URLs remain compatibility routes. Marketing copy must distinguish the product blueprint and previews from completed operational features.
* The target frontend separates public marketing/legal pages, authenticated tenant portal routes, and authenticated platform administration routes. Frontend visibility is not authorization: backend policies must enforce each area's access. Privacy/terms pages, portal authentication, and the platform dashboard remain planned.

### Encapsulation & The "Index Barrier" Rule

* Files inside `/modules/<module-a>` must never deep-import internal files from `/modules/<module-b>`.
* Inter-module imports must only consume what is exported through the target module's root `index.ts`. If `/modules/parcels` needs client data, it imports through `@modules/clients`.
* Generic, reusable components (like `Modal`, `Table`, `Input`) and layouts shared by application areas live in `frontend/src/global-components`, imported through its `@global-components` public index. Module-specific compositions (like `ParcelStatusBadge`) must stay in `/modules/<module>/components`.

### Form Handling & Validation

* Standardize on **React Hook Form** paired with **Zod** schema validation across all module forms.
* Every form component must cleanly handle `isSubmitting`, display field-level validation errors, and disable mutating buttons during active API flights.

* **Workspace picker (planned):** After login, company users choose from server-verified active memberships before tenant data loads; provide an in-session company switcher. One-company accounts still see their company in the picker. Platform access remains a separately authorized area.
* **Company cache/state isolation:** Include the identity/session boundary and verified organization ID in all tenant query keys. The shared session store holds the active organization and an in-memory bearer token; the HTTP client supplies headers, which the backend must independently verify. On switches, hide the old tenant views, cancel and clear cached queries, reset company stores/forms/drafts/permissions, and ignore late responses/events from the previous context. Scope pending writes and optimistic rollbacks to the company where they started. Partition any persisted/shared state by identity/company, leave old subscriptions, and clear private state on logout/account changes. Current query cancellation is only a foundation; verify isolation with the [workspace-switch acceptance cases](Tenant-Onboarding-and-Login-Flow.md#implementation-acceptance).
* The marketing rollout form creates a downloadable brief in the browser. It does not send leads, emails, or personal details to an API.

### Translations (i18n)

* The frontend uses react-i18next with English, Arabic, and Thai. Text lives in `frontend/src/locales/<language>/<namespace>.json`, one namespace per module; `common` holds the shared components and the workspace shell. Keys are nested camelCase, for example `t('pagination.rowsPerPage')`.
* Write the English text first. TypeScript checks every key against the English files, so a wrong key fails `npm run build`. Files are loaded automatically; a new namespace file needs one line in `frontend/src/locales/i18next.d.ts`.
* In a module, call `useTranslation('<namespace>')`. Shared components receive plain strings from their callers and translate only their own fixed text.
* Arabic and Thai may lag behind: a missing key shows the English text, and `npm run lint` lists it as a warning. `node scripts/check-translations.js --strict` (from `frontend/`) turns the warnings into a failure. Keep `{{placeholders}}` identical to English.
* Format numbers and dates with `formatNumber` and `formatDate` from `@utils/format`, passing `i18n.resolvedLanguage ?? 'en'`. Every language shows Latin digits (1,234) and the Gregorian year (2026). Money amounts stay strings and are not passed to `formatNumber`.
* Use start/end utilities (`ms-*`, `ps-*`, `inset-s-*`, `border-s`, `text-start`) instead of left/right ones so layouts mirror for Arabic. ESLint warns about left/right classes.

---

## 3. MariaDB Persistence & Query Rules

1. **Explicit Indices:** Every foreign key column, search query target (`client_code`, `tracking_number`, `mobile_1`), and state filter (`lifecycle_status`, `dispatch_status`) must carry an explicit index.
2. **Precision Decimals:** Never use `FLOAT` or `DOUBLE` for monetary or capacity values. Always use `DECIMAL(12, 2)` for currency and `DECIMAL(8, 2)` for weights and volumes.
3. **No Direct Balance Mutations:** Modifying `clients.current_balance` directly without an accompanying entry in `merchant_ledger_entries` is strictly prohibited. Ledger mutations must execute inside an ACID transaction block.

4. **Migration ownership:** `backend/src/database/migrations` is the authoritative schema history. `synchronize` and automatic application-start migrations are disabled. Compose runs a dedicated migration service before the API starts. Add a new migration for each schema change; do not edit an applied baseline. MariaDB DDL commits implicitly, so a failed migration requires inspection before retrying.
5. **Driver precision:** BIGINT identifiers and currency cross the database boundary as strings. Do not enable decimal-to-JavaScript-number conversion. GPS coordinates retain their separate documented precision.
