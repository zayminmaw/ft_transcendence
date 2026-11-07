# Identity, access, and workspaces

**Status:** Implemented rules with required isolation gaps and open product differences. See the [draft conventions](README.md).

## Accounts and credentials

| Rule | Business behavior | Status |
| --- | --- | --- |
| IAM-01 | There is no public signup. Authorized administrators provision accounts. | Implemented / Required |
| IAM-02 | Username and email identify a global account and are globally unique. A duplicate must not reuse or overwrite an existing identity. | Implemented |
| IAM-03 | Usernames contain 3–64 ASCII letters, digits, dots, underscores, or dashes. The shared account creator trims username/email and restricts email to printable ASCII, at most 191 characters. Platform provisioning uses a separate, looser email validator. | Implemented; harmonization open |
| IAM-04 | New passwords have 8–128 characters and at least one ASCII uppercase letter, lowercase letter, digit, and non-alphanumeric character. Store Argon2id hashes. Login checks credentials rather than reapplying password complexity rules. | Implemented |
| IAM-05 | A login containing `@` selects email lookup; otherwise it selects username lookup. Database collation makes lookup case-insensitive. Login input is trimmed and limited to printable ASCII without spaces. | Implemented |
| IAM-06 | Unknown accounts, wrong passwords, and inactive accounts return the same invalid-credentials response. Failed attempts are audited; an unknown login name is not stored in the audit event. | Implemented |

An account's `is_active`, a membership's `is_active`, company `is_active`, employee employment status, and driver duty status are different facts. Turning off a membership removes access to that company; it does not disable the global account or its other companies.

### Password login

1. Submit login identifier and password to `POST /api/auth/login` from the allowed site origin.
2. Verify the password and active account. An account without usable company memberships may still authenticate.
3. Start a session, issue a 15-minute access JWT, and set the refresh cookie.
4. Fetch `GET /api/auth/me`: account identity, active companies with role and usable permission codes, `platformAccess`, and `mustChangePassword`.
5. Complete mandatory password replacement if flagged; otherwise resolve a workspace or platform destination.

**IAM-07 — Throttling (Implemented).** Password login is limited to five attempts per minute per IP plus normalized login and twenty per IP overall. Refresh has thirty per minute per IP; password changes have five per minute per account. These counters are in memory in one API process; they are not a durable account lockout.

**IAM-08 — Request origin (Implemented).** Login, refresh, and logout require an `Origin` matching configured `CORS_ORIGIN` or the request's own scheme/host/port. Missing or foreign origins are refused. This is separate from bearer authorization.

### 42 login

**IAM-09 — Existing-account login only (Implemented).** 42 login exchanges an authorization code, obtains the profile email, and signs into the matching active local account. It creates no account, membership, or persisted external-identity link. Email matching is the current identity-resolution policy.

The callback checks a browser state cookie, clears it for every attempt, and redirects successful login to `/app` with the same refresh-cookie flow as password login. Failures redirect to `/login?oauth=denied|failed|no_account|unavailable`. External tokens and client secrets are not stored or returned. A callback's email match does not bypass mandatory password replacement on a flagged local account.

## Sessions and ending access

| Rule | Implemented behavior |
| --- | --- |
| IAM-10 | Each login creates one session family. Refresh tokens contain a stable random family ID and a rotating random secret. Only secret hashes are stored. |
| IAM-11 | Refresh eligibility ends after seven days idle or thirty days absolute lifetime, whichever occurs first. Refresh extends idle expiry without extending absolute expiry. |
| IAM-12 | Refresh locks the session row and rotates the secret. The just-replaced secret is accepted for ten seconds to tolerate a missed response; this interval is not extended by retries of that secret. Any other secret for that family revokes it as reuse. |
| IAM-13 | Refresh requires an active account. Company suspension does not end the account session; tenant authorization separately denies that company. |
| IAM-14 | Logout revokes the presented session family and clears the refresh cookie. Missing/unusable cookies still produce a safe logout response. An old secret outside the reuse allowance is recorded as reuse. |
| IAM-15 | Access tokens stay in browser memory. Refresh cookies are HttpOnly, SameSite=Strict, scoped to `/api/auth`, and Secure except in development. |

**Access-token limitation.** JWT validation does not consult the refresh-session row or password version. Logout, reset, and session revocation stop refresh; they do not immediately invalidate an already-issued access token. Active account/membership/company checks still apply on protected requests. An unflagged JWT may otherwise remain usable until its fifteen-minute expiry. Do not describe server-side session revocation as immediate cancellation of every bearer token.

The browser shares refresh work within a page and uses a Web Lock across tabs where supported. Successful logout broadcasts to other tabs and clears private query/session state. A failed logout keeps the client session and reports failure. Network errors, throttling, and server errors during refresh are treated as unavailable, preserving the possibility that the session is still valid; a refresh 401 ends it.

## Choosing or replacing a password

**IAM-16 — Mandatory replacement (Implemented for member creation/reset).** Company-created accounts and admin-reset accounts receive `must_change_password=true`. Their newly issued JWTs carry the flag. Protected endpoints refuse flagged tokens except explicitly allowed `/auth/me` and `/auth/password`; public login/refresh/logout remain available. The frontend redirects to `/change-password`.

**IAM-17 — Own password change (Implemented).** Require the current password, validate a different new password, then update only if the stored hash still matches the one checked. This prevents an overlapping admin reset from being overwritten. Clear the flag, revoke other refresh sessions, audit, and return a new access token. Keep the session family named by the request's refresh cookie; without it, revoke all refresh sessions.

**Open difference:** Platform-created tenant administrators use a separate insertion path that does not set the flag; the database default is false. The first-platform-admin command also sets false, because the operator chooses their own password. See DEC-03 before claiming mandatory replacement applies to every admin-provisioned account.

## Authorization policies

| Endpoint policy | What the server requires | What it does not grant |
| --- | --- | --- |
| `@Public()` | Route-specific checks, such as credentials, origin, OAuth state, or a file signature | General protected access |
| `@Authenticated()` | Valid bearer and active account | Membership or platform authority |
| `@PlatformAdmin()` | Valid bearer, active account, global `platform_admin` in `user_roles` | Automatic tenant operational permissions |
| `@RequirePermission(code)` | Valid bearer, active account/company/membership, positive `X-Organization-Id`, exact role permission with scope `all` | Other companies or ungranted actions |

**IAM-18 (Implemented).** Missing policy metadata is denied. Platform/account-only/tenant policies cannot be combined to weaken the boundary. Guards establish verified company context before the tenant interceptor enforces it.

**IAM-19 (Implemented).** `assigned_only` grants fail closed until resource ownership rules exist. `/auth/me` exposes only `all` grants to the interface. The seeded driver role therefore receives no usable tenant permission codes today, even though its intended grants are present in the database.

**IAM-20 (Implemented).** Platform policy checks the global role, not per-action platform permission codes. Those exact platform codes are not seeded. The older requirement for granular platform permissions is still a decision, not current enforcement.

### Seeded role behavior

| Role | Current scope and responsibility |
| --- | --- |
| `platform_admin` | Global platform role; no seeded permission-code grants. A tenant membership with this code alone grants no platform access. |
| `org_admin` | Only `admin.manage_users`, `admin.manage_roles`, and `admin.audit_logs`, all company-scoped; no automatic dispatch or billing grants. |
| `dispatcher` | Merchant view/create/edit; parcel view/create/dispatch/status/delivery; driver view; asset view/assign. |
| `hub_sorter` | Parcel view and status updates. |
| `finance` | Merchant/parcel financial views and fee override, payroll/driver earnings, billing operations, and audit. |
| `hr_manager` | Staff/driver management, payroll, earnings, and compliance. |
| `fleet_lead` | Driver view/compliance and asset view/create/assignment/maintenance. |
| `driver` | Assigned-only parcel view/status/delivery and own earnings; currently denied by IAM-19. |

The [reference-data migration](../../backend/src/database/migrations/1792195260000-AuthReferenceData.ts) is the exact 30-code grant matrix. Role definitions and grants are shared across companies; current membership is one role per account/company, not a union of multiple tenant roles.

## Workspaces and isolation

**IAM-21 — Discovery (Implemented).** `/auth/me` returns active memberships in active companies, sorted by company name, with each company's role and usable permissions. A URL slug, remembered choice, or header does not create membership.

Current routing is `/login` → `/app` → `/app/:companySlug`. Platform routes are separately guarded under `/platform`. No available company and no platform access produces an access-unavailable state. Multiple destinations produce a picker. **One company and no platform access auto-enters that company and hides the switch menu**, conflicting with the existing requirement to show the picker even for one company (DEC-01).

**IAM-22 — Existing isolation foundation (Implemented).** Company pages wait until the URL resolves to a discovered workspace and the active request context matches it. Switching cancels/removes non-auth queries before updating active company. Tenant query keys include account ID and organization ID; platform keys use a separate prefix. The HTTP client captures organization context at request start and retains it on a 401 retry. Entering platform clears active company context.

**IAM-23 — Complete isolation contract (Required; not established by current code alone).** Unmount old company state, reset drafts/forms/filters/permissions and subscriptions, and reject stale responses, mutation callbacks, optimistic rollbacks, and events across company and account changes. Scope pending mutations to the company where they began. Query cancellation is not cancellation of an accepted server write.

Current key helpers use user ID rather than an explicit session generation. Many query functions do not forward an AbortSignal; mutation completion handlers can consult the newly active company. These foundations require race and browser verification before claiming complete isolation. Authorized real-time company subscriptions do not exist yet.

## Behavioral checks

- Valid credentials can authenticate a platform-only or company-less account; a company request still requires membership and permission.
- Disabling a membership or company blocks its next protected tenant request without disabling other companies.
- Driver assigned-only grants remain denied until ownership checks are introduced.
- Password replacement rejects a wrong current password, a weak/unchanged new password, and a concurrent reset's stale hash.
- Refresh tolerates the just-replaced secret only within its interval; expired or older secrets cannot keep a family alive.
- Company A → B, account A → B, slow responses, pending writes, logout, and multiple tabs cannot mix private results. These remain acceptance obligations, not results of this review.

## Sources

- [Auth controller](../../backend/src/modules/auth/auth.controller.ts), [authentication service](../../backend/src/modules/auth/auth.service.ts), [sessions](../../backend/src/modules/auth/sessions.service.ts), [session locking](../../backend/src/modules/auth/sessions.repository.ts)
- [Account creation](../../backend/src/modules/users/accounts.ts), [password policy](../../backend/src/modules/users/password.ts), [roles guard](../../backend/src/modules/rbac/roles.guard.ts), [membership discovery](../../backend/src/modules/organizations/organization-members.repository.ts)
- [42 service](../../backend/src/modules/forty-two/forty-two.service.ts), [frontend routes](../../frontend/src/app/routes.tsx), [workspace picker](../../frontend/src/modules/auth/pages/WorkspacePickerPage.tsx)
- [Company boundary](../../frontend/src/app/CompanyBoundary.tsx), [switching](../../frontend/src/hooks/useActiveOrganization.ts), [API client](../../frontend/src/services/api-client.ts), [session refresh](../../frontend/src/services/session-refresh.ts), [query keys](../../frontend/src/utils/query-keys.ts)
- Existing checks: [auth](../../backend/test/auth.test.cjs), [password change](../../backend/test/password-change.test.cjs), [42](../../backend/test/forty-two.test.cjs), [security](../../backend/test/security.test.cjs), [database auth](../../backend/test/db/auth.db.test.cjs)
