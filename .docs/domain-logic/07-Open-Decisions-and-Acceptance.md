# Open decisions and acceptance

**Status:** Review register. All decisions below are unresolved by this draft. Suggested review roles are proposals, not assigned owners. See the [draft conventions](README.md).

## Code and requirement differences

| ID | Evidence and consequence | Decision needed | Suggested reviewers |
| --- | --- | --- | --- |
| DEC-01 | [Onboarding requirement](../Tenant-Onboarding-and-Login-Flow.md) requires a picker even for one company. [Picker code](../../frontend/src/modules/auth/pages/WorkspacePickerPage.tsx) auto-enters one company without platform access. | Keep explicit single-company selection or revise the requirement to match auto-entry. | Product + frontend |
| DEC-02 | Existing outline requires explicit platform permissions; [guard](../../backend/src/modules/rbac/roles.guard.ts) checks only global `platform_admin`, and seeds contain no platform action codes. | Accept a single platform authority for this release or specify/implement granular platform actions. | Product + identity |
| DEC-03 | Company member creation/reset enables mandatory password change; [platform insertion](../../backend/src/modules/platform/tenant-writes.ts) does not set it. Platform provisioning also accepts emails outside the shared account creator's ASCII policy. | Unify account provisioning/validation and first-login policy, or document intentional exceptions. | Identity + platform |
| DEC-04 | Platform revoke/status changes protect usable-admin counts with company locks; [member mutations](../../backend/src/modules/members/members.service.ts) do not. Concurrent company edits could remove all admin access. | Define and enforce the invariant across every route, including self/platform and account-disable cases. | Platform + identity |
| DEC-05 | Transactional audit is required; member/auth workflows persist state/session/audit steps separately. | Choose atomic command boundaries and recovery for each step; do not report a failed command as if rollback is guaranteed. | Backend + audit |
| DEC-06 | Revoking refresh sessions does not revoke existing JWTs; forced password-change enforcement uses the JWT's flag. Reset credentials have no TTL/consume-on-login mechanism. | Accept the bounded access-token window and temporary-password semantics, or add session/version checks and expiry. | Identity + product |
| DEC-07 | Current cache keys include account/company but no session generation. Cancellation does not prove abort or stale callback isolation. | Implement/test company and account race isolation, unsaved work, pending writes, cross-tab identity changes, and subscriptions. | Frontend + identity |
| DEC-08 | Roles/grants are global shared definitions; company role assignment excludes only `platform_admin`. Role overview API exists, with no editing endpoints or current frontend role-overview consumer. | Agree tenant-owned custom-role scope, escalation ceilings, and UI/API contract before role editing. | Identity + product |

## Operational and financial policies

| ID | Unresolved policy | Why it must be explicit | Suggested reviewers |
| --- | --- | --- | --- |
| DEC-09 | Merchant archive, employee offboarding/subtype changes, multi-company employee links, driver eligibility, and asset custody limits | Current flags/FKs do not implement a complete lifecycle; `employees.user_id` is globally unique and open asset custody is not unique. | Operations + HR/fleet |
| DEC-10 | Parcel transition matrix, assignment versus physical release, allowed skips/corrections, retry limit/count meaning, RTS request versus completion | Enums and sample screens do not define permitted transitions or attempt semantics. | Dispatch + product |
| DEC-11 | Required POD, actual collection capture, secure file-ID references, and ownership rules for drivers | Existing parcel URL columns and settlement-required collections do not provide the full delivery/POD/COD workflow. | Dispatch + backend + finance |
| DEC-12 | Currency, rounding, tariffs, fee/insurance/surcharge timing, and financial override window | No currency/tax/rate model or executable recognition policy exists. | Finance + product |
| DEC-13 | Pending COD trigger, discrepancy tolerance/resolution, partial collection, and cash/card/QR handling | One cash-drop total cannot safely reconcile mixed collection methods without a policy. | Finance + operations |
| DEC-14 | Invoice formula/sign, ledger/invoice offset relationship, payments/payouts, corrections, and idempotency | Schema does not define posting triggers; issuing a statement must not duplicate fees or settled COD. | Finance + backend |
| DEC-15 | Contact role matrix, add permission, directed/reciprocal saves, suspension versus removal, and heartbeat timings | Contacts/presence are required but lack schema and authorization contracts. | Product + identity + frontend |
| DEC-16 | File access after suspension, orphan cleanup, file deletion/retention, audit purge, and monitoring-read audit | Signed links remain valid until expiry; database cascades do not remove disk bytes; not all reads are audited and no purge worker exists. | Backend + product |

These are decisions to settle before implementing dependent behavior, not requests for blanket approval to write code. Each accepted policy should identify its owner, date, final wording, affected rules, required migration/API changes, and acceptance evidence.

## Documentation conflicts to reconcile

| Existing document | Current mismatch |
| --- | --- |
| [ERP outline](../ERP-Logistics-System-Outline-v1.md), [Product](../../PRODUCT.md), early [README](../../README.md) sections | Describe login screens/portal authentication/platform dashboard/legal pages as future work; related code now exists. Operational delivery and finance still remain future work. |
| [Onboarding and login](../Tenant-Onboarding-and-Login-Flow.md) | Labels provisioning, login UI, and workspace picker unimplemented despite current code, and conflicts with one-company auto-entry. |
| [Technical architecture](../System-Technical-Architecture.md) | Mixes an implemented tenant-management API section with older public-preview/platform-only-planned statements; activity now has an API and consumer. |
| [Data dictionary](../Data-Dictionary-and-Entity-Relationship-Reference.md) | Includes later session/audit/storage additions but retains older platform/provisioning/role-seed status statements. A role name in an example is not a seeded authority. |
| [Storage guide](../File-Storage.md) | Example uses `parcels.update`, which is not a seeded permission; select the owning action's actual permission such as `parcels.mark_delivered` or `parcels.update_status`. Signed downloads do not recheck membership. |
| [Best practices](../Best-Practices-Guidelines.md) | Contains older planned platform/account-only wording alongside current audit guidance; its full transactional-audit goal is not yet met by every caller. |
| [Release 0.1.0](../releases/0.1.0.md) | Describes a historical release. Preserve that scope/date; add later release notes rather than rewriting it as the current feature list. |

This draft adds a current domain reference without rewriting all older documents or resolving product choices implicitly. When decisions are accepted, update current architecture/product references and keep historical release notes historical.

## Acceptance scenarios

**Evidence labels:** “Existing tests” identifies checked-in tests inspected during review. “Review required” means a missing contract, implementation, or broader verification. No test in this table was executed as part of the documentation change.

| ID | Given / when | Expected result | Evidence / status |
| --- | --- | --- | --- |
| ACC-01 | Active user authenticates with username/email, or known matching 42 email | Session starts; active workspaces and independent platform access discovered; no account auto-created | Existing [auth](../../backend/test/auth.test.cjs), [42](../../backend/test/forty-two.test.cjs) |
| ACC-02 | User lacks membership, company is suspended, account/membership inactive, permission missing, or grant assigned-only | Company action refused; platform/account-only access follows its separate policy | Existing [security](../../backend/test/security.test.cjs), [auth database](../../backend/test/db/auth.db.test.cjs) |
| ACC-03 | New tenant creation hits duplicate account/slug or persistence failure | No partial company/admin/membership/audit commit; no credential disclosure | Existing [platform database](../../backend/test/db/platform.db.test.cjs); forced rollback cases can be broadened |
| ACC-04 | Two platform admins revoke the final usable administrators concurrently | One incompatible choice fails; active tenant is not left unadministered by the platform path | Existing platform database race test; company-member equivalent is Review required |
| ACC-05 | Reactivation attempted with no usable admin, then an admin assigned while suspended | First request conflicts; assignment can repair access; later reactivation succeeds | Existing platform database tests |
| ACC-06 | Admin creates/changes/deactivates a company member | Only this company changes; platform role cannot be assigned; self changes forbidden; existing identity not overwritten | Existing [members](../../backend/test/members.test.cjs), [accounts](../../backend/test/accounts.test.cjs) |
| ACC-07 | Admin resets account used in another company or with a global role | Neutral refusal without disclosing other companies; own-company-only reset issues temporary credential and revokes refresh sessions | Existing members tests; immediate JWT revocation policy is Review required |
| ACC-08 | Flagged account changes password while a reset wins a race | Stale old-hash update fails; otherwise new password replaces old, clears flag, and ends other refresh sessions | Existing [password-change](../../backend/test/password-change.test.cjs) |
| ACC-09 | Refresh response is lost; replaced secret retried within/after allowance | Ten-second allowance works without extending itself; older/late secret revokes family; concurrency safe | Existing auth and database auth tests |
| ACC-10 | Switch A → B with matching record IDs, unsaved forms, slow queries, pending writes/rollbacks, then logout/login as another account | No old data, callbacks, credentials, roles, drafts, or events appear in the new context | Review required: browser/integration race coverage |
| ACC-11 | Two assignments/checkouts race, or a parcel references another company's merchant/driver/asset | One valid responsibility outcome; cross-company links refused; history retained | Review required: operational services absent |
| ACC-12 | Delivery fails, is retried, succeeds, or returns, including duplicate command submission | Approved transitions/counter/POD rules enforced; terminal correction explicit; no duplicate events or money | Review required: DEC-10/11 first |
| ACC-13 | Reconciliation includes shortage, multiple merchants, mixed methods, duplicate verification, or concurrent ledger posting | Approved allocation/discrepancy rules; one posting per event; correct atomic balances | Review required: billing service absent; DEC-12/13/14 first |
| ACC-14 | Invoice is issued after fees already posted; payout confirmation retried | Statement does not charge twice; payout posts once and never uses unverified funds | Review required: invoice/payout workflows absent |
| ACC-15 | Audit transaction commits/rolls back; reader lacks permission or requests another company's row | Correct scoped view; rollback publishes/stores nothing; supported refused reads audited | Existing [audit HTTP](../../backend/test/audit.test.cjs), [audit database](../../backend/test/db/audit.db.test.cjs) |
| ACC-16 | Tenant and platform read audit details containing personal/business changes | Tenant sees allowed own changes; platform values masked/withheld; platform actor network hidden from tenant | Existing audit tests |
| ACC-17 | Another company requests a file, signed link altered/expired, or metadata insert fails | Scoped refusal, signature refusal, or compensated upload failure; no claim of immediate signed-link revocation | Existing [storage](../../backend/test/storage.test.cjs), [storage database](../../backend/test/db/storage.db.test.cjs); lifecycle cleanup Review required |
| ACC-18 | Contact role changes, target suspends, one of several tabs closes, relationship removed, or company switches | Exactly Online/Offline/Suspended; existing saved status survives role change; removed access ends subscriptions; no cross-company activity | Review required: contacts/presence not implemented |

## Suggested completion order

1. Agree the identity/platform differences and make administration/audit invariants consistent across existing routes.
2. Approve parcel states, driver/asset eligibility, POD, and collection capture before making preview actions persistent.
3. Approve finance recognition, signs, currency, corrections, and idempotency before exposing balances or payouts.
4. Define contact relationship/presence authorization and lifecycle before wiring private data into notifications.
5. Add migration/API contracts and behavioral acceptance evidence for each approved rule, then update this draft's status labels.
