# Tenants and members

**Status:** Implemented administration workflows, with differences from the required contract called out below. See the [draft conventions](README.md).

## Tenant lifecycle

A tenant is an `organizations` record. `is_active=true` allows otherwise-authorized company access; false suspends it. Suspension preserves memberships, parcels, and accounting history. There is no tenant-deletion API.

| Rule | Implemented behavior |
| --- | --- |
| TEN-01 | Only a global platform administrator can create/manage tenants through the platform API. A tenant role or company header cannot confer that authority. |
| TEN-02 | Onboarding creates the company, a new administrator account, its active `org_admin` membership, and the platform audit row in one database transaction. Failure rolls the transaction back. |
| TEN-03 | Organization name, unique slug, contact email, and first-administrator username/email/password are required. Phone/address are optional. Contact and login email are separate values. |
| TEN-04 | Slugs are at most 64 lowercase letters/digits with single separating dashes. Slug is fixed after creation; edits allow name and contact details. The current management DTO does not expose tax-ID editing. |
| TEN-05 | Existing username/email collisions fail onboarding or new-administrator assignment. Neither path silently attaches or resets an existing identity. Unique database constraints also reject concurrent duplicates. |
| TEN-06 | Success returns company and administrator identity details, never the initial password/hash. There is no automatic credential email or invite service. |

Usual duplicate checks return `TENANT_SLUG_TAKEN`, `USERNAME_TAKEN`, or `EMAIL_TAKEN`. A racing database duplicate is sanitized to a generic 409; callers must not assume every uniqueness conflict has a field-specific code.

### Suspend and reactivate

| Current state | Command | Preconditions | Result |
| --- | --- | --- | --- |
| Active | Suspend | Nonblank reason, up to 500 characters | Suspended; audit old/new status and reason |
| Suspended | Reactivate | At least one usable administrator; optional reason | Active; audit old/new status |
| Active | Reactivate | — | Conflict `TENANT_ALREADY_ACTIVE` |
| Suspended | Suspend | — | Conflict `TENANT_ALREADY_SUSPENDED` |
| Suspended, no usable administrator | Reactivate | — | Conflict `TENANT_HAS_NO_ADMINISTRATOR` |

**TEN-07 — Usable administrator.** Count active `org_admin` memberships whose global account is active. The company's own suspension does not exclude candidates, because administrators must be assignable before reactivation.

**TEN-08 — Access effect.** Suspension denies subsequent tenant requests through membership resolution and removes the company from active workspace discovery. It leaves platform management and the account's other companies available. It does not erase data or globally revoke refresh sessions.

**TEN-09 — Serialization.** Platform status changes, administrator assignments, and revocations lock the company row first. Their count-and-change decisions occur inside that transaction. This protects the invariant within those platform operations; company member operations do not currently take the same lock (see MEM-10).

## Assigning tenant administrators

Assignment has two explicit modes:

| Mode | Preconditions | Changes |
| --- | --- | --- |
| `new` | New global username/email and valid credentials | Create account plus active `org_admin` membership |
| `existing` | Active global account with an existing membership in this company | Replace its role with `org_admin` and reactivate its membership if inactive |

**TEN-10.** Both modes work while the company is suspended. Existing mode can restore a previously removed membership; it does not search arbitrary global identities or attach a user from another company. An already-active administrator is a conflict.

The candidate list includes active accounts with current or inactive memberships, excluding current active administrators. It searches username/email and returns at most fifty entries, current memberships first. Inactive global accounts are excluded. These are selection rules, not account-reactivation powers.

**TEN-11.** Assignment changes tenant membership only; it never writes a global `user_roles` platform assignment. New platform-created administrator accounts currently retain the default `must_change_password=false`; decide the intended policy in DEC-03.

## Revoking tenant administrators

The platform caller must provide a reason and explicitly choose the outcome. The server rechecks the remaining usable-administrator count under the company lock.

| Other usable administrators remain? | Requested outcome | Behavior |
| --- | --- | --- |
| Yes | `change_role` | Keep membership active and replace its role with an available non-admin company role |
| Yes | `remove` | Deactivate membership; preserve global account and other companies |
| Yes | `suspend_tenant` | Refuse with `NOT_LAST_ADMINISTRATOR` |
| No | `change_role` or `remove` | Refuse with `LAST_ADMINISTRATOR` |
| No | `suspend_tenant` | Deactivate membership and suspend the company if active, in one transaction |

**TEN-12.** A revoked administrator cannot be moved to `org_admin` or `platform_admin`; the actual database role is checked, including case-insensitive lookup. Other roles come from the shared database, not a hardcoded list of six roles.

**TEN-13.** Removing membership preserves its stored role but makes it inactive. Last-administrator revocation records both revoke and suspension events when the company was active. If already suspended, it records only revoke and returns `tenantSuspended=false`, meaning this command did not cause a new suspension.

**TEN-14.** Stale client choices are conflicts, not permission to substitute a different outcome. Refresh the current state and let the user choose the now-applicable outcome.

## Tenant directory and activity

Directory search covers company name/slug; filters cover active/suspended/all. Sorting is name, active-member count, or creation time with ID as a tie-breaker. Page sizes are 10, 25, or 50. Directory counts summarize all companies independently of the current search/status filter.

**TEN-15.** An active-member count means active membership plus active global account. Total memberships include inactive ones. The displayed first administrator is the earliest active admin membership and can still have an inactive account; use the usable-administrator definition for reactivation/revoke decisions rather than that display field.

**TEN-16.** `/api/platform/activity` reads platform management audit rows, supports tenant/action/search/sort/paging, and returns summary counts for the last seven days. Counts honor optional tenant scope, not the current search/action filter. This is management history, not operational delivery metrics or infrastructure monitoring. Names shown there come from joins to current accounts/companies; the shared audit trail separately keeps actor snapshots.

## Company member management

**MEM-01 — Authority.** `/api/members` requires `admin.manage_users` in the verified company. `GET /api/members/roles` instead requires `admin.manage_roles`. The acting company cannot be supplied in a create body to override the verified header context.

| Use case | Preconditions | Implemented result |
| --- | --- | --- |
| List people | `admin.manage_users` | All memberships in this company, including inactive memberships; username/email/role/last login/password-change flag |
| Create person | Valid new global identity, allowed role, initial password | Account and active membership commit together; mandatory password replacement enabled |
| Activate/deactivate | Target in this company and not actor | Change membership active flag only |
| Change role | Target in this company and not actor; allowed role | Replace the role for this membership only |
| Reset password | Target in this company and not actor; no other-company membership or global role | Generate temporary password, set must-change flag, revoke all refresh sessions, return temporary password |
| View roles | `admin.manage_roles` | Shared role/grant definitions plus membership counts for this company, including inactive memberships |

**MEM-02 — Role assignment.** Company-assignable roles are every role except `platform_admin`, including `org_admin`. Current service logic does not compare the target role's permissions against the actor's grants; the seeded default gives user management only to `org_admin`. If customizable roles are introduced, an escalation policy must accompany them.

**MEM-03 — Creation scope.** Create accepts username, email, password, and role code. It does not link an employee, reuse an existing account, send an invitation, or add an arbitrary existing identity to another company. The required optional personnel link remains unimplemented.

**MEM-04 — Target protection.** Malformed/nonexistent/out-of-company user IDs produce `MEMBER_NOT_FOUND`. Self deactivation, self role change, and self reset produce `MEMBER_SELF`. These limits are for company member APIs; do not assume platform revoke has the same self restriction.

**MEM-05 — Membership effect.** Deactivation and role changes affect the next tenant request because the guard reloads membership/grants. Other-company memberships and the global account remain untouched. Repeating the current active state or role is a no-op with no new audit entry. A PATCH must request exactly one of `isActive` and `roleCode`.

**MEM-06 — Reset boundary.** A membership in another company blocks reset even when that membership is inactive. Any global `user_roles` assignment also blocks it. Both return the same neutral `MEMBER_NOT_ALLOWED` message so the caller does not learn where else the account is used.

**MEM-07 — Temporary credentials.** A successful reset returns a generated sixteen-character password for immediate handover, never in audit. The UI holds it in the reset dialog and password mutations use zero garbage-collection time. "One-time" currently means intended replacement at next login; the password has no separate TTL and is not consumed merely by authenticating. Existing unflagged access tokens have the limitation described in IAM-15.

**MEM-08 — Shared roles.** Role/grant overview is read-only. There are no APIs to create company-specific roles or edit permission mappings. Global shared definitions must not be presented as tenant-owned editable records.

**MEM-09 — Transaction difference.** Company account and membership creation are atomic, but member audit is written afterward through `recordStandalone`. Activation, role changes, and password reset also perform their state/session/audit steps separately. Therefore an audit/session failure can follow a persisted state change; these commands do not yet meet DOM-03's full atomicity requirement.

**MEM-10 — Administrator survival difference.** The platform revoke path protects the last-administrator rule. Company member deactivation/role-change paths only prohibit editing oneself; they do not count administrators, lock the company row, or suspend the tenant. Two admins acting concurrently could remove one another's admin access. Treat global enforcement of the administrator-survival invariant as an open gap (DEC-04).

## Route reference

| API | Purpose |
| --- | --- |
| `GET /api/platform/tenants`, `POST /api/platform/tenants` | Directory and transactional onboarding |
| `GET/PATCH /api/platform/tenants/:tenantId` | Details and permitted edits |
| `POST /api/platform/tenants/:tenantId/suspend` or `/reactivate` | Company status |
| `GET /api/platform/tenants/:tenantId/members` or `/member-roles` | Admin candidates and revoke destinations |
| `POST /api/platform/tenants/:tenantId/administrators` | New/existing administrator assignment |
| `POST /api/platform/tenants/:tenantId/administrators/:userId/revoke` | Explicit administrator revocation outcome |
| `GET /api/platform/activity` | Management history |
| `GET/POST /api/members`, `PATCH /api/members/:userId` | Company people and membership changes |
| `GET /api/members/assignable-roles`, `GET /api/members/roles` | Allowed roles and read-only overview |
| `POST /api/members/:userId/password-reset` | Restricted reset |

## Sources and existing checks

- [Tenant service](../../backend/src/modules/platform/tenants.service.ts), [repository](../../backend/src/modules/platform/tenants.repository.ts), [shared transaction steps](../../backend/src/modules/platform/tenant-writes.ts), [DTOs](../../backend/src/modules/platform/dto/tenant.dto.ts)
- [Administrator repository](../../backend/src/modules/platform/tenant-administrators.repository.ts), [activity repository](../../backend/src/modules/platform/activity.repository.ts)
- [Member service](../../backend/src/modules/members/members.service.ts), [repository](../../backend/src/modules/members/members.repository.ts), [audit adapter](../../backend/src/modules/members/members-audit.repository.ts)
- [Platform frontend mutations](../../frontend/src/modules/platform/hooks/useTenantMutations.ts), [people creation](../../frontend/src/modules/rbac/pages/CreateUserPage.tsx), [reset dialog](../../frontend/src/modules/rbac/components/ManageMemberDialog.tsx)
- Existing checks: [platform database](../../backend/test/db/platform.db.test.cjs), [activity database](../../backend/test/db/activity.db.test.cjs), [members HTTP](../../backend/test/members.test.cjs), [auth database](../../backend/test/db/auth.db.test.cjs). These include concurrent platform revocation, duplicates, scope restrictions, and reset boundaries; they do not prove MEM-09/MEM-10 are resolved.
