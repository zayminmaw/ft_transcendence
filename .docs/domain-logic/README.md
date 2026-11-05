# Transcend domain logic — working draft

**Status:** Draft for team review. **Reviewed:** 2026-10-29. **Code baseline:** `3dd7bd0`.

Transcend connects parcel movement, operational responsibility, and merchant accounting inside a courier company. This documentation describes the business rules behind those workflows, including who may act, what may change, and what must remain consistent.

## Read this first

| Document | Scope |
| --- | --- |
| [Core user and system flows](00-Core-User-and-System-Flows.md) | End-to-end commercial, parcel, COD reconciliation, onboarding, and fleet workflows |
| [Identity, access, and workspaces](01-Identity-Access-and-Workspaces.md) | Login, passwords, sessions, authorization, company selection, and isolation |
| [Tenants and members](02-Tenants-and-Members.md) | Tenant onboarding, suspension, administrators, company accounts, and role assignment |
| [Merchants, people, and fleet](03-Merchants-People-and-Fleet.md) | Merchant ownership, personnel subtypes, driver eligibility, and asset custody |
| [Parcels and delivery](04-Parcels-and-Delivery.md) | Intake, dispatch, delivery outcomes, retries, returns, and evidence |
| [COD, ledger, and invoicing](05-COD-Ledger-and-Invoicing.md) | Cash handover, merchant balances, charges, invoices, and payouts |
| [Audit, storage, and contacts](06-Audit-Storage-and-Contacts.md) | History access, file ownership, signed links, contacts, and presence |
| [Open decisions and acceptance](07-Open-Decisions-and-Acceptance.md) | Conflicts, missing policies, and review scenarios |

## How to interpret a rule

| Label | Meaning |
| --- | --- |
| **Implemented** | Executable code enforces the behavior. This review establishes source behavior; it does not certify a running deployment. |
| **Schema only** | A migration defines data or constraints, but the business workflow has no service/API implementation. |
| **Required** | Existing project documents explicitly require the behavior. Implementation may be incomplete. |
| **Proposed** | This draft recommends a rule or workflow for review. It is not an approved requirement or existing capability. |
| **Open** | Evidence conflicts or does not determine a policy. The team must decide before treating it as a contract. |

Each rule has a stable identifier so implementation tasks and acceptance checks can refer to it. A section's status applies to its rules unless a rule says otherwise. Proposed transitions and accounting examples are deliberately identified as proposals.

For current behavior, read code and versioned migrations before older status prose. For intended behavior, use the agreed requirements and explicitly resolve conflicts with code. A database enum defines possible stored values; it does not prove that transitions, validations, or side effects exist.

## Domain language

| Term | Meaning |
| --- | --- |
| Tenant / company / organization | A courier business using Transcend. Its operational records belong to this boundary. |
| Account / user | A global login identity; it may have memberships in several companies. |
| Membership | An account's relationship with one company: one role and one active flag. |
| Platform administrator | An account with a global `platform_admin` assignment in `user_roles`. |
| Tenant administrator | A member with the `org_admin` role in a particular company. |
| Merchant / client | A business shipping through a tenant. It is not another tenant or automatically a login account. |
| Recipient | The person receiving a parcel; no recipient account or public tracking workflow is established. |
| Employee | A company's personnel record, optionally linked to a login account. |
| Staff / driver | Distinct specializations of an employee, with office or field responsibilities. |
| Dispatch | Assigning responsibility for delivery; a dispatch-run entity is not present. |
| POD | Proof of delivery, such as a signature, photo, or delivery location. |
| COD | An amount collected from a recipient for the merchant. Delivery and cash verification are separate facts. |
| Driver settlement | Reconciliation of a driver's collection sheet and money handed over. |
| Merchant settlement | Resolving a merchant's balance by payout or payment; distinct from driver reconciliation. |
| Ledger | The merchant's credits and debits, with a recorded balance after each entry. |

## Domain boundaries and ownership

| Domain | Owns | Depends on |
| --- | --- | --- |
| Identity and access | Accounts, passwords, sessions, role grants | Active account and membership checks |
| Platform administration | Company lifecycle and tenant administrators | Global platform role; identity creation; audit |
| Company access | Company memberships and tenant role assignment | Verified company context; shared role definitions |
| Merchants | Merchant identity, contacts, pickup details, agreed rate profile | Company ownership; billing for balance posting |
| People and fleet | Employment, driver details, assets, custody, maintenance | Company ownership; optional account links |
| Parcel operations | Parcel identity, responsibility, status, delivery evidence | Same-company merchant, driver, asset, and storage |
| Billing | Reconciliation, merchant ledger, invoices, payouts | Parcel facts; merchant ownership; exact decimal arithmetic |
| Audit | Append-only history and controlled history reads | Caller-supplied resource policy and transaction |
| Contacts and presence | Planned member relationships and company connection status | Active access; saved relationship; role-pair add policy |

These are responsibility boundaries, not a requirement to split the modular monolith into separate services. Billing owns balance mutations; parcel status alone must not be treated as verified cash or a completed payout.

## Current capability map

| Area | Observed state |
| --- | --- |
| Password and 42 login; refresh/logout; `/auth/me` | Implemented, with login UI and guarded frontend routes |
| Workspace selection and switching | Implemented foundation; one-company users auto-enter; complete state/race isolation remains unverified |
| Tenant creation/details/status; administrator assignment/revocation | Implemented API and frontend consumers |
| Platform activity | Implemented API and frontend consumer; management history with seven-day counts |
| Company members | Implemented creation, list, role change, membership activation, restricted password reset, and read-only role overview APIs; frontend supports member list/creation/activation/reset |
| Role-definition editing | Not implemented; roles/grants are shared reference data and the overview is read-only |
| Audit trail | Implemented writer, retention triggers, scoped reads, and tenant frontend; transaction coverage varies by caller |
| File storage | Implemented reusable service and public signed-download route; no parcel upload workflow |
| Merchants, staff, drivers, assets | Schema only; backend modules empty and frontend pages placeholders |
| Parcels | Schema plus sample frontend queue/detail/assignment screens; no persistent operational actions |
| COD, merchant ledger, invoices, payouts | Schema only for reconciliation/ledger/invoices; payout service and dedicated payout entity absent |
| Contacts and authorized presence | Required, not implemented |
| Notifications | Generic broadcast scaffold; no company/contact authorization or presence service |
| Public website | Marketing, privacy, terms, and browser-local contact brief routes exist; no lead/email submission service |

## Rules shared by all domains

1. **DOM-01 — Company ownership (Implemented foundation / Required for future domains).** Every tenant action must derive its company from verified membership. Scope reads, writes, and every referenced merchant, employee, driver, asset, file, and finance record to that company. Ordinary foreign keys do not enforce this relationship.
2. **DOM-02 — Separate authorities (Implemented).** Platform authority, account authentication, and tenant permissions are separate policies. Tenant admin is not a wildcard role. UI visibility does not authorize a request.
3. **DOM-03 — Atomic business changes (Required; partially implemented).** A multi-record business change and its audit entry must commit together. Every merchant balance mutation requires its corresponding ledger entry in that transaction. See the documented exceptions in [tenants and members](02-Tenants-and-Members.md) and [audit](06-Audit-Storage-and-Contacts.md).
4. **DOM-04 — Precision (Implemented database configuration / Required in future services).** BIGINT IDs and monetary values cross the database boundary as strings. Currency uses `DECIMAL(12,2)`; dimensions and capacities use `DECIMAL(8,2)`. Use exact decimal arithmetic for calculations. The current schema has no currency column or exchange-rate model.
5. **DOM-05 — Preserve responsibility (Required / Proposed implementation).** Reassignment and exceptions must retain their history. Financial corrections need traceable entries rather than unexplained balance overwrites. The exact reversal mechanism remains open.
6. **DOM-06 — Retry behavior (Proposed for new business commands).** Retrying a successful delivery, COD verification, fee posting, or payout must not duplicate its event or money movement. Unique parcel references cover only some duplicates; explicit command idempotency remains to be designed.

## Evidence reviewed

The review covered all files present in `.docs/` before this draft, the root product/README references, executable schema and subsequent migrations, backend domain controllers/services/repositories/guards, and the relevant frontend routes, API consumers, state, and sample parcel flows. Existing HTTP and database test cases were inspected as behavioral evidence. No build, application tests, database migrations, or live integrations were run for this documentation-only change.

| Existing reference | Use in this draft |
| --- | --- |
| [ERP outline](../ERP-Logistics-System-Outline-v1.md) | Target domains, role responsibilities, permission vocabulary, intended business flow |
| [Onboarding and login](../Tenant-Onboarding-and-Login-Flow.md) | Provisioning, picker, credential handling, and company-isolation requirements |
| [Contacts and status](../Contacts-and-Online-Status.md) | Required contact eligibility, relationship access, and three statuses |
| [Storage guide](../File-Storage.md) | Storage ownership and caller responsibilities |
| [Architecture](../System-Technical-Architecture.md) | Module boundaries, authorization, platform administration, and persistence |
| [Data dictionary](../Data-Dictionary-and-Entity-Relationship-Reference.md) | Entity vocabulary and documented constraints |
| [SQL snapshot](../maria-db-scheme-draft.sql) | Baseline reference; matches executable baseline after ignoring comments/whitespace |
| [Best practices](../Best-Practices-Guidelines.md) | Transaction, audit, precision, access, and state-isolation expectations |
| [Deployment strategy](../Containerization-Deployment-Strategy.md) | Persistence/deployment context; no additional business policy inferred |
| [Git guide](../Git_Guide.md) | Documentation and domain ownership conventions |
| [Release 0.1.0](../releases/0.1.0.md) | Historical scaffold scope; not a current implementation inventory |
| [Product](../../PRODUCT.md), [README](../../README.md), [visual reference](../../DESIGN.md) | Product intent and setup context; visual examples do not define domain rules |

Older references contain mixed implementation dates. [Open decisions](07-Open-Decisions-and-Acceptance.md) records material conflicts rather than silently treating old status text as current or changing historical release notes.
