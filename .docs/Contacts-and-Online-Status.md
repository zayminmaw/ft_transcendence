# Company contacts and online status

## Requirement and implementation status

**Users can add other users as contacts and see their status.** Tenant roles determine who can be added within the active company workspace. Once a contact has been validly added, viewing that contact's status is included; there is no separate role-based status permission. The only contact statuses are **Online**, **Offline**, and **Suspended**.

This is required product behavior, not an implemented feature. Contact persistence, role-based add policies, APIs, real-time delivery, and frontend views still need implementation. The existing 22-table baseline does not contain a contacts relationship or an online-presence service.

## Role-based contact eligibility and grouping

Use the acting user's role and the target user's role in the selected company to determine whether the contact can be added. Group eligible users and saved contacts primarily by their tenant roles. Department can remain an optional filter or display label; it must not determine add eligibility. Roles from another company or global platform roles do not grant contact access in the current company.

| Acting tenant role | Example of permitted contact targets | Purpose |
| --- | --- | --- |
| HR Manager | HR colleagues and the configured employee-role set | Add the employee contacts HR needs for its work. |
| Dispatcher | Courier/Driver roles and permitted Dispatcher peers | Add drivers and dispatch colleagues for coordination. |
| Courier / Driver | Dispatcher roles and other explicitly permitted target roles | Add operational contacts without unrestricted company-wide additions. |
| Other roles | Only target roles explicitly allowed by the company's contact policy | Deny unconfigured role pairings. |

The examples define intended role relationships; the complete allowed role-to-role matrix, permission codes for managing one's own contacts, and role seeds still need implementation contracts. **Employees** may be a friendly display group aggregating configured tenant roles rather than a new role or department enum value. A role assignment is sufficient input to the contact policy even if an account has no personnel/department link; existing staff/driver permissions alone must not implicitly allow contact additions.

Apply role-based eligibility when listing candidates and when accepting an add request on the server. Client filtering or hiding an Add button is insufficient. Adding/removing one's own contacts remains distinct from administering other users' lists. Do not introduce a separate `presence.view` or equivalent role gate for saved contacts.

## Adding and viewing contacts

- Users can search/browse eligible role groups, add permitted users to their own contacts, view saved contacts grouped by tenant role, and remove contacts from their own list.
- On addition, both users must have active accounts and active memberships in the same active company, and the acting-role → target-role pairing must be allowed. Reject cross-company targets, suspended targets, duplicates, self contacts, and disallowed role pairings.
- An existing saved contact grants access to that contact's status in that company without another role check for status. Authenticate the viewer and verify active company access, contact ownership, and the same-company relationship on status reads/subscriptions. Role changes affect future additions and group labels; they do not independently hide an existing contact's status.
- A suspended target remains in existing contact lists with **Suspended** status. A suspended viewer cannot access company contacts. Removing a contact or permanently removing the relevant company membership ends contact/status access and subscriptions; suspension of a target is not treated as contact removal.
- Return only the saved contact's permitted identity, role/group label, and status. Adding a contact does not create membership, grant access to other companies, or grant access to salaries, banking/national-ID data, compliance records, or other restricted personnel fields.
- The same two global users can have independent contact relationships in different companies where both belong. Never reveal another company membership or activity through the contact list.

## Contact statuses

Use exactly these three contact statuses:

| Status | Meaning |
| --- | --- |
| **Online** | The target is not suspended and has at least one current, authorized connection/heartbeat in this company workspace. |
| **Offline** | The target is not suspended and has no current company-workspace connection after heartbeat/connection expiry. |
| **Suspended** | The target's account or membership in this company is suspended. This overrides any live connection or previously cached Online/Offline value. |

Contact status is separate from a driver's operational duty status such as `Available`, `Out for Delivery`, or `Off Duty`. An online driver is not automatically available for assignment. `users.last_login_at` is not proof of current online status. Define heartbeat/expiry timings so broken connections cannot leave a contact permanently Online. Loading indicators and connection-error messages are UI conditions, not additional contact statuses; do not add Unknown, Away, Busy, or Reconnecting status values.

Aggregate multiple tabs/devices within the same company: closing or logging out of one connection must not mark the member offline if another authorized connection remains. On workspace switching, leave the old company's presence/subscriptions for that connection and establish presence only in the selected company. Do not expose activity from other companies.

Authorize status subscriptions/events by the authenticated viewer's active company access and saved contacts, not a separate presence role policy. Do not broadcast all company users' statuses and rely on client filtering. Target suspension must invalidate stale Online/Offline values, stop the target's company access/live connections, and update existing contacts to Suspended. On reactivation, recompute Online/Offline from valid current connections. Revoke subscriptions when contact relationships or company access end.

## Persistence and workspace isolation

The planned contact relationship must carry company context and owner/target membership references, prevent duplicate/self contacts, and validate that both memberships belong to the same company. Add reviewed migrations rather than editing the applied baseline. Derive status from account/membership suspension first, then transient company presence; do not add a permanent `users.is_online` flag as the authority. Suspension semantics and any schema support needed to distinguish suspension from permanent membership removal must be explicitly defined in the implementation contract rather than assumed from the baseline's `is_active` flags.

Contact queries, saved lists, presence maps, search results, and selected groups must follow the [company cache/state isolation rules](Tenant-Onboarding-and-Login-Flow.md#prevent-cache-and-state-leakage-between-companies). Scope them by identity/session and company, clear/reset them on switching/logout, unsubscribe from old company events, and reject delayed responses/events from the old workspace. Backend checks remain mandatory even when the frontend hides a group.

## Acceptance requirements

- The server enforces the configured acting-role → target-role matrix for candidate lists and contact additions. Department changes alone cannot grant or deny add eligibility.
- Adding/removing contacts affects only the acting member's list in the active company. Cross-company targets, suspended/inactive targets, duplicates/self contacts, and disallowed role pairings are rejected.
- Once a contact is validly added, its status is available without a separate role-based presence permission. Role changes do not independently hide saved-contact status; removing the relationship or company access ends that access.
- The only status values are Online, Offline, and Suspended. Verify multiple tabs/devices, dropped connections, suspension overriding a still-live connection/cached Online value, and reactivation; driver duty status remains independent.
- Company A → B switching, queued events/slow responses, logout/account changes, and persisted caches never expose A's contacts or online statuses in B.
