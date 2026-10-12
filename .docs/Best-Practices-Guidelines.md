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
* **Assigned-only access:** The scaffold denies `assigned_only` permissions until resource ownership policies exist. No accounts, role seeds, or wildcard administrator bypass are installed.
* **Platform versus tenant access:** The required platform administration dashboard needs a dedicated platform authorization policy. Tenant administrators may manage membership, employees, roles, and permissions only within their own organization; they cannot grant platform roles or access other tenants. Platform tenant-management actions must use explicit permissions and audit records, rather than bypassing tenant guards. These platform services are planned, not implemented.



### Defensive Error Handling

* Throw native NestJS `HttpException` instances (`NotFoundException`, `ConflictException`, `BadRequestException`).
* Never leak raw database error strings to the client. A global `HttpExceptionFilter` intercepts SQL errors (e.g., MariaDB error code `1062` duplicate entry) and outputs clean, actionable JSON payloads.

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
* Generic, reusable components (like `Modal`, `Table`, `Input`) live in top-level `/components`. Module-specific compositions (like `ParcelStatusBadge`) must stay in `/modules/<module>/components`.

### Form Handling & Validation

* Standardize on **React Hook Form** paired with **Zod** schema validation across all module forms.
* Every form component must cleanly handle `isSubmitting`, display field-level validation errors, and disable mutating buttons during active API flights.

* Include the verified organization ID in all tenant query keys. The shared session store holds the active organization and an in-memory bearer token; the HTTP client automatically supplies headers. Cancel and clear cached queries when switching organizations or logging out.
* The marketing rollout form creates a downloadable brief in the browser. It does not send leads, emails, or personal details to an API.

---

## 3. MariaDB Persistence & Query Rules

1. **Explicit Indices:** Every foreign key column, search query target (`client_code`, `tracking_number`, `mobile_1`), and state filter (`lifecycle_status`, `dispatch_status`) must carry an explicit index.
2. **Precision Decimals:** Never use `FLOAT` or `DOUBLE` for monetary or capacity values. Always use `DECIMAL(12, 2)` for currency and `DECIMAL(8, 2)` for weights and volumes.
3. **No Direct Balance Mutations:** Modifying `clients.current_balance` directly without an accompanying entry in `merchant_ledger_entries` is strictly prohibited. Ledger mutations must execute inside an ACID transaction block.

4. **Migration ownership:** `backend/src/database/migrations` is the authoritative schema history. `synchronize` and automatic application-start migrations are disabled. Compose runs a dedicated migration service before the API starts. Add a new migration for each schema change; do not edit an applied baseline. MariaDB DDL commits implicitly, so a failed migration requires inspection before retrying.
5. **Driver precision:** BIGINT identifiers and currency cross the database boundary as strings. Do not enable decimal-to-JavaScript-number conversion. GPS coordinates retain their separate documented precision.
