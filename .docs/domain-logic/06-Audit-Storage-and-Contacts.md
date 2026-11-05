# Audit, storage, and contacts

**Status:** Audit and storage foundations are implemented; company contacts and authorized presence are required but not implemented. See the [draft conventions](README.md).

## Audit purpose and write rules

The audit trail answers who acted, in which company, on what resource, when, from which request, with what outcome, and what allowed values changed. Technical logs and parcel handling events serve different purposes; neither replaces audit history.

| Rule | Implemented foundation |
| --- | --- |
| AUD-01 | Write through `AuditService` or the shared `recordAudit` function. Resource type must be registered; an unknown resource fails rather than storing unclassified snapshots. |
| AUD-02 | Store only the resource's allowlisted fields. Keys resembling passwords, tokens, secrets, cookies, authorization, sessions, OTPs, or API keys cannot be allowlisted. Unlisted entity fields are omitted. |
| AUD-03 | Update entries retain only changed allowlisted values. Other actions keep allowlisted snapshot context. Actor username/role are snapshotted; company/actor IDs survive deletion because audit foreign keys were removed. |
| AUD-04 | Audit rows cannot be updated. Database triggers reject deletion until after `retain_until`. These protections apply to audit, not automatically to merchant ledger or parcel event tables. |
| AUD-05 | Passing the business transaction manager makes the change and audit row atomic. `recordStandalone` is a separate write and provides no cross-operation rollback guarantee. |
| AUD-06 | In-process subscribers receive events after transaction commit; rollback discards them. Listener failure is logged and does not undo the committed change. There is no durable event outbox or retry delivery guarantee. |

Registered resources today are `user`, `session`, `member`, `tenant`, `tenant_administrator`, and `audit_log`. Parcel, invoice, merchant, payroll, and asset resources must be registered when those workflows are added; they are not automatically audited by an ORM hook.

**AUD-07 — Required integration contract.** New domain mutations must write auditable entity snapshots in the same transaction. Keep labels/translation params free of secrets and unnecessary personal information; the allowlist does not detect personal content placed inside a permitted plain string. Company member/auth commands currently use standalone audit steps; platform mutations put audit inside the transaction. Do not claim all existing mutations are fully atomic with audit.

### Retention and severity

| Event category / severity | Minimum configured retention |
| --- | --- |
| Security | 365 days |
| Data | 180 days |
| Platform | 180 days |
| Access to audit | 90 days |
| Any critical event | 365 days regardless of category |

Session reuse defaults to critical, failed login and denied outcomes to warning, delete/revoke/password reset to notice, and other actions to info. These are implementation defaults, not a statement of legal retention requirements. No scheduled purge job is implemented; reaching expiry permits deletion but does not automatically remove the row.

### Who may read history

| API / scope | Authorization | View |
| --- | --- | --- |
| `/api/audit-logs` and `/:id` | Company membership plus `admin.audit_logs` | That company's rows and allowlisted changes |
| `/api/audit-logs/mine` | Active authenticated account | Only rows whose actor is this user, across their recorded actions; no company header needed |
| `/api/platform/audit-logs` and `/:id` | Global platform admin | Cross-company event metadata; tenant business-data values withheld; platform-visible fields masked according to rules |
| `/api/audit-logs/access` | Company `admin.audit_logs` | Capability check only; does not add a read event |

**AUD-08 (Implemented).** Tenant-scoped details outside the company return not found. Successful list/detail reads of audit are themselves audited. The attached filter attempts to record forbidden (403) audit reads. Do not claim that every API read, missing record, malformed query, unauthenticated request, or platform directory/activity read is audited.

**AUD-09 (Implemented).** A company sees changes that platform staff made to it, while their IP and user agent are hidden from that company's audit view. Platform audit views suppress changes for tenant `data` rows; other changes follow field-level masking. Allowlisted personal values are stored in their original form and masked on platform read, not irreversibly anonymized at write time.

**AUD-10 (Implemented).** Lists default to newest occurrence then newest ID, page size 25 (maximum 100), with module/resource/record/action/actor/time filters. Audit-access rows are excluded unless explicitly requested by audit module or resource. A record filter does not widen the server-selected scope.

The platform activity endpoint is a separate projection of management rows. It shows selected management details, not full old/new payloads. Requirements to audit monitoring access beyond shared audit reads remain unimplemented.

## Stored files and business ownership

Storage owns bytes and metadata, not the permission to see a business record. The parcel/people/other owning module must authorize the operation before calling it.

| Rule | Implemented behavior |
| --- | --- |
| STO-01 | Files live below a company folder with a random UUID storage name. Client filename is display metadata only. |
| STO-02 | Company-scoped find/download/delete/signed-link creation require company plus file ID; another company's ID produces the same not-found response. The service assumes a verified company ID from its caller. |
| STO-03 | Save writes bytes, then inserts metadata. A failed insert attempts to remove the bytes. This compensation is not a transaction covering the owning business record. |
| STO-04 | Delete removes bytes before metadata, tolerates already-missing bytes, and scopes metadata deletion by company. Owning modules must clear references and request file cleanup. |
| STO-05 | Reusable upload options allow one file up to 10 MiB: JPEG/PNG/WebP images or PDF/Word documents. Type filtering trusts the supplied MIME type; no byte-content inspection or malware scanner is present. |

There is no generic upload API. The signed GET route is storage's only controller route. Owning domain controllers still need upload validation, record authorization, durable references, and audit.

### Signed links

**STO-06 (Implemented).** An authorized caller can generate `/api/storage/files/:id?exp=...&sig=...`. The link itself allows anyone holding it to read that file without login or company header. Expiry rounds to five-minute boundaries, leaving roughly ten to fifteen minutes of validity. Altering the file ID/expiry/signature or using an expired link is refused.

**STO-07 — Access lifetime limitation.** Signed download validates signature and expiry, then looks up the file; it does not recheck company suspension, membership, or account access. Previously issued links therefore remain usable until expiry or file removal, and browsers may retain already-downloaded copies. For a record needing authorization on every fetch, serve through an owning domain route using company-scoped `download` instead. Do not claim suspension immediately revokes a signed link.

**STO-08 (Required).** Persist a file ID in the owning record, never a disk path or expiring signed URL. The parcel URL columns need an agreed migration for file references. A failed business save after successful file upload can leave an orphan; business/storage cleanup policy remains to be implemented.

**STO-09 (Open).** Removing a company cascades file metadata in SQL but does not remove its disk folder. There is no tenant-delete route or general orphan cleanup worker. Define lifecycle cleanup before supporting deletion, replacement, or legal retention workflows for files.

## Contacts and company presence

Everything in this section is **Required**, derived from the existing contacts specification, unless marked Open. No contacts relationship table, APIs, role-policy implementation, presence tracking, or contact frontend exists.

### Relationship and add policy

**CON-01.** A contact is an owning company member's saved relationship to another member in the same company. Both accounts and memberships must be active in an active company when adding. Reject self contacts, duplicates, cross-company targets, suspended targets, and disallowed role pairings.

**CON-02.** Use a server-enforced acting-tenant-role → target-tenant-role matrix both for candidate listing and adding. Department is a display/filter label, not eligibility authority. Another company's role and global platform role do not confer contact rights here.

| Acting role | Existing requirement's examples, not a complete implemented matrix |
| --- | --- |
| HR Manager | HR colleagues and configured employee-role set |
| Dispatcher | Permitted Driver and Dispatcher roles |
| Driver | Dispatcher and any other explicitly permitted target roles |
| Other role | Only explicitly configured role pairings; deny unconfigured pairs |

**CON-03.** A saved contact grants access to that contact's company status without a second presence-role permission. Reads/subscriptions still require an active authorized viewer, relationship ownership, and same-company membership. Changing roles affects future additions and group labels; it does not independently hide an already-saved contact's status.

**CON-04.** Removing a contact or permanently removing relevant company membership ends access and subscriptions. Suspending the target preserves existing contact visibility as Suspended, but blocks target access and new additions. A suspended viewer cannot read company contacts. Adding a contact grants no payroll, compliance, personal-record, or other-company access.

**CON-05 (Open).** Decide whether saves are directed only or require reciprocity/consent; the current text describes owned lists but establishes no invitation/approval workflow. Exact role matrix, manage-own-contact permission code, and suspension-versus-removal persistence semantics remain unresolved. The current membership active flag alone does not represent all those states.

### Exactly three contact statuses

| Status | Derivation |
| --- | --- |
| Suspended | Target account or this company's target membership is suspended; overrides any connection |
| Online | Not suspended; at least one current authorized connection/heartbeat in this company |
| Offline | Not suspended; no valid company connection after expiry |

**CON-06.** Do not use account-global `is_online`, `last_login_at`, employee status, or driver `dispatch_status` as presence authority. Loading, reconnecting, and network errors are UI conditions, not additional status values.

**CON-07.** Aggregate tabs/devices in the same company: closing one connection does not make the target Offline if another valid one remains. On company switch, move that connection out of old-company presence/subscriptions. Never reveal another company's activity.

**CON-08.** Authorize events for each viewer's saved contacts; do not broadcast every company member's status and rely on client filtering. Remove subscriptions on contact/access loss and override stale Online data on suspension. On reactivation, recompute Online/Offline from valid current connections.

**CON-09 (Open timing).** Heartbeat frequency, expiry interval, reconnect behavior, and connection invalidation must be specified and tested. They are not implied by a Socket.IO connection alone.

### Existing notification scaffold

`EventsGateway.sendNotification` emits to the entire Socket.IO server and uses wildcard CORS. It has no account, membership, company-room, or contact authorization. The frontend `useWebSocket` hook connects without auth and logs notifications; no application caller currently invokes that hook, and no domain caller invokes `sendNotification`.

This scaffold is not an implementation of contacts, authorized presence, or secure tenant notifications. Private domain events must not be wired to it until server-side audience authorization and company/session lifecycle rules are implemented. The audit subscriber API is also only an extension point; it is not connected to a notification delivery service.

## Sources and existing checks

- [Audit resources](../../backend/src/modules/audit/audit-resources.ts), [writer](../../backend/src/modules/audit/audit-writer.ts), [publisher](../../backend/src/modules/audit/audit-publisher.ts), [policy](../../backend/src/modules/audit/audit-policy.ts), [controller](../../backend/src/modules/audit/audit.controller.ts), [view](../../backend/src/modules/audit/audit-log.view.ts)
- [Append-only migration](../../backend/src/database/migrations/1792627200000-AuditTrail.ts), [member audit](../../backend/src/modules/members/members-audit.repository.ts), [auth audit](../../backend/src/modules/auth/auth-audit.repository.ts)
- [Storage service](../../backend/src/modules/storage/storage.service.ts), [controller](../../backend/src/modules/storage/storage.controller.ts), [upload options](../../backend/src/modules/storage/upload-options.ts), [storage guide](../File-Storage.md)
- [Contacts requirements](../Contacts-and-Online-Status.md), [notification gateway](../../backend/src/modules/notifications/events.gateway.ts), [frontend socket hook](../../frontend/src/hooks/useWebSocket.ts)
- Existing checks: [audit HTTP](../../backend/test/audit.test.cjs), [audit values](../../backend/test/audit-values.test.cjs), [audit database](../../backend/test/db/audit.db.test.cjs), [storage](../../backend/test/storage.test.cjs), [storage database](../../backend/test/db/storage.db.test.cjs)
