# Tenant onboarding and login flow

## Status and scope

This is the required product behavior and the contract for the proposed Figma screens. Tenant provisioning, account creation, login/refresh, and authenticated frontend routing still need implementation. The current dashboard routes are layout previews; this document does not make them authenticated services.

There is no public signup. Accounts are provisioned by authorized administrators. A tenant is a courier organization, not a merchant account.

## Required journey

1. An authenticated platform administrator with explicit tenant-creation permission opens **Create tenant**.
2. The platform administrator enters the organization details and the required first administrator's account details. Completing onboarding creates the tenant, its first administrator account, and an active `org_admin` membership together.
3. The first tenant administrator receives their account access details through a secure handover, signs in on the shared **Log in** page, and selects their company in the workspace picker.
4. Within that tenant, a user with `admin.manage_users` creates additional user accounts, links personnel records where applicable, and assigns an allowed tenant role. Role/permission mapping changes separately require `admin.manage_roles`.
5. The new user receives their access details, signs in on the same **Log in** page, and selects a company workspace from their verified memberships. Their role and permissions in the selected company determine the actions available to them.

The core sequence is **onboard tenant and create first administrator → administrator logs in and chooses company → administrator creates user → user logs in and chooses company**. Department labels can organize people and navigation; roles and permissions authorize access.

## Create tenant and first administrator

- Organization details include its name, unique slug, contact email, and optional phone/address. Organization contact email and administrator login email are separate fields and can differ.
- First-administrator account details include a unique username, login email, and initial credentials. The proposed Figma form shows a masked initial-password field; plaintext credentials must never appear in confirmations, audit events, logs, or ordinary API responses. Passwords are hashed before storage. Secure credential handover and password recovery still require an implementation contract; no email delivery is implied by the prototype.
- The first administrator is required, not an optional follow-up assignment. Do not report tenant creation as successful if the administrator account or its membership failed. Commit the organization, new account, and `org_admin` membership in one database transaction; roll them back together on failure.
- Validate username/email uniqueness before completing onboarding and handle concurrent duplicate conflicts safely. Do not silently reuse, overwrite, or reset an existing account. Linking an existing identity needs a separately reviewed, explicitly authorized flow.
- The administrator receives tenant-scoped permissions, including the ability to create company accounts. This membership must not create a global platform role in `user_roles`.
- Confirm that both the tenant and first administrator were created. Show the tenant, administrator login identifier, and next step. Provide links to tenant details and the login page without exposing a password.
- Audit the platform actor, target tenant, action, and outcome, excluding credentials. Tenant details and administrator management must show the initial administrator and subsequent changes.

Later administrator assignments/revocations remain separate platform management actions; they do not replace the required initial administrator during onboarding.

## Tenant account creation

The acting user must have an active user account, active tenant membership, an active tenant, and `admin.manage_users` in that tenant. The server derives and verifies the tenant context rather than trusting a submitted organization or role identifier.

Create the account and tenant membership together, with an allowed role and a same-tenant personnel link where applicable. `admin.manage_users` does not authorize changing role-permission definitions, granting platform roles, or creating accounts in another tenant. Prevent privilege escalation through role assignment. The proposed form collects username, email, masked initial password, role, and an optional personnel link; the company context is fixed to the verified tenant.

## Shared login page and session routing

**Proposed route:** `/login`. This is a planned UI route, not an implemented endpoint. The proposed form accepts **email or username** and **password**. It has a password-visibility control and a **Log in** submit action, with no signup link. Users without account access are directed to their company administrator; recovery remains a separate implementation decision.

1. Validate the form, submit credentials to the planned authentication service, show a submitting state, and return a generic invalid-credentials message without revealing whether an account exists.
2. Verify the password and active account before establishing a session. Authentication does not grant tenant or platform permissions by itself.
3. Resolve permitted application areas and active memberships on the server. After authentication, company users enter the required workspace picker and choose the company to open before loading tenant data. Show only verified, active memberships in active companies. A single-company user sees that one company; with none available, show an access-unavailable state and company-administrator guidance.
4. Platform administration at `/platform` requires independently verified global platform roles and exact platform permissions. A platform-only account must be able to authenticate without tenant membership. An account allowed into both areas may also have a separately authorized platform entry; this is distinct from choosing a company. Never infer platform access from a company header or tenant role.
5. Tenant requests continue to require an active user, active organization, active membership, and the exact required permission. Suspended tenants and inactive memberships cannot enter tenant business workflows, even if the account can authenticate.
6. On logout or session expiry, clear the client session and organization-scoped cache and return to login. Keep redirects local and limited to routes the user is authorized to access.

Account-only endpoints such as current-user details and logout need an explicit authenticated-without-tenant policy. If an `@Authenticated()` decorator is introduced, retain JWT and active-user verification and update both the permission guard and `TenantContextInterceptor` for that explicit policy. Unannotated protected endpoints must still be denied; tenant and platform endpoints retain their independent authorization requirements. This policy is proposed, not implemented by this documentation change.

## Company workspace picker (required, not implemented)

The agreed product flow uses a workspace picker similar to Slack: authenticate once, then choose which company workspace to enter. One account may belong to multiple companies and have different roles in each. Keep the existing Figma **Choose workspace** page as the design starting point; its platform entry illustrates separately authorized platform access, not a company membership or an automatic privilege for tenant administrators.

The picker lists only companies returned by an authenticated membership-discovery service; that service must work before an active company has been selected. Choosing a company does not create membership or grant access. Revalidate membership and company status on selection and on every protected request. Show the active company clearly in the workspace and provide a picker/switcher for moving to another authorized company without logging out. A remembered selection is a preference only, never authorization or permission to bypass the post-login picker. No tenant data may load while selection or membership verification is pending.

### Prevent cache and state leakage between companies

- **Treat switching as an isolated transition.** Hide/unmount the old company's business views, stop new tenant requests, handle unsaved work explicitly, and verify the destination membership before rendering the new company. A failed switch must not display the old company's records beneath the new company's name.
- **Scope caches to identity and company.** Every tenant query key must include the authenticated identity/session boundary, verified organization ID, resource, and relevant parameters. Never reuse cached/placeholder/previous data from another company, including when record IDs match. Keep platform caches separate from tenant caches.
- **Cancel and clear on switching.** Cancel outgoing queries and clear company caches before fetching destination data. Requests must capture their organization context when started. Ignore late responses and callbacks from earlier company/session generations so they cannot populate the new company's cache, UI, notifications, or errors.
- **Account for writes already in progress.** Clearing the client cache does not undo or necessarily cancel a server mutation. Keep pending writes, completion notifications, optimistic updates, and rollback handlers tied to the original company; never retarget them to the newly selected company or apply their results there.
- **Reset other company state.** Clear company roles/permissions, selected records, filters, pagination, forms, drafts, uploads, and module-level stores unless explicitly retained under an identity-and-company namespace. Recompute navigation and actions from the destination membership. Never copy unsaved work into the next company implicitly.
- **Isolate subscriptions.** Leave the previous company's WebSocket rooms/subscriptions and reject queued events from its old context before joining the next company's channels. Future real-time features must enforce the same boundary on the server.
- **Scope persistent and shared state.** If browser storage, persisted queries, service-worker caches, cross-tab messages, or shared backend caches are introduced, partition private data by identity/company and enforce authorization. Never restore another account's or company's data through a global storage key, browser history, or a stale remembered selection. A switch in one tab must not silently rewrite another tab's request context while it still displays the previous company.
- **Clear on account boundaries.** Logout, expiry, account changes, membership revocation, or loss of tenant access must stop relevant requests/subscriptions and remove private cached and in-memory state before another account/workspace can render.
- **Keep server isolation mandatory.** Client clearing is an additional safeguard. APIs, repositories, linked-record checks, and any server caching must still enforce the verified organization and permission scope for every read and mutation; a client-supplied company ID alone never grants access.

The current frontend cancels queries and clears its query client when switching organizations, but this is only scaffold behavior. The picker, membership discovery, protection against late responses, and complete application-state isolation still need implementation and verification.

## Implementation acceptance

- Tenant creation cannot succeed without its first administrator and tenant membership; failures leave no partial onboarding records.
- Public signup is unavailable. Tenant account creation requires `admin.manage_users` and cannot cross tenant boundaries or grant platform roles.
- Login supports valid administrator and ordinary-user accounts; invalid credentials, disabled accounts, unavailable memberships, and suspended tenants cannot expose protected data.
- Account-only and platform-only authentication paths work without weakening tenant guards or allowing missing authorization metadata.
- Company users choose from verified memberships after login and can switch between their authorized company workspaces. Single-company and no-access states are handled explicitly; platform access remains independent.
- Switching company A → B → A never shows one company's records, roles, drafts, or selections inside another. Verify matching resource IDs, slow outgoing requests, pending/failed writes and rollback handlers, and queued subscription events.
- Logout/login as another account, session expiry, revoked membership, persisted browser state, browser back navigation, and multiple tabs must not restore or mix private company data. Document and verify these boundaries when the relevant persistence/real-time features are implemented.
- Confirmations and audit records never disclose passwords. Figma interactions remain simulations using illustrative identities.
