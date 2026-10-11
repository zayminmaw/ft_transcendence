# Transcend

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The core audience is courier operations and finance teams at parcel delivery and last-mile logistics businesses. This audience was confirmed during product initialization.

| User group | Job to accomplish |
| --- | --- |
| Dispatchers and hub operators | Coordinate merchant intake, sorting, driver assignments, parcel progress, and delivery exceptions. |
| Finance and merchant account teams | Reconcile driver cash handovers, delivery fees, merchant balances, invoices, and settlements. |
| Couriers and fleet leads | Manage delivery responsibilities, driver availability, vehicles, equipment, and compliance. |
| HR and administrators | Maintain personnel records, organization membership, accounts, and role permissions. |

Merchants are client accounts whose shipments, charges, and balances the ERP manages. A merchant self-service portal is not an established capability. The public website also serves people evaluating whether the planned product fits their courier operation.

## Product Purpose

Transcend is a centralized, multi-tenant ERP for courier operations and accounting. Its intended purpose is to connect the movement of parcels with the people, assets, and financial records responsible for them.

Product success means teams can follow a parcel from intake through delivery or return, identify responsibility at each handoff, and reconcile the associated cash and merchant balance within the correct organization. These are target outcomes, not measured results from a deployed product.

## Positioning

The product blueprint joins dispatch and delivery workflows with cash-on-delivery reconciliation and merchant settlement in one modular workspace. Operational progress and financial responsibility are related parts of the same parcel lifecycle.

This is the intended product mechanism. No comparative performance claims, market leadership, customer adoption, or proprietary advantages have been established.

## Operating Context

The planned working environment spans back-office dispatch, hub handling, field delivery, fleet management, and finance. Different roles require different access to shared organizational records.

The target workflows are:

1. Maintain merchant accounts, contact details, pickup information, and agreed delivery terms.
2. Create parcel records with waybills, recipients, package details, delivery fees, and COD amounts.
3. Coordinate pickup, hub sorting, driver and vehicle assignment, and delivery progress. Failed attempts and returns are exceptions with their own outcomes.
4. Record delivery evidence and reconcile the cash collected and handed over by drivers.
5. Post merchant ledger entries, itemize charges, and settle a payout or invoice the amount due.

Supporting workflows cover staff and driver records, fleet custody and maintenance, organization membership, and access administration. These workflows describe planned ERP behavior; the current workspace provides module previews.

## Capabilities and Constraints

### Available in the initial scaffold

- Public landing, product, solutions, and contact pages at `/`, `/product`, `/solutions`, and `/contact`, with an interactive delivery/settlement illustration.
- A validated operations brief that can be downloaded as text. Its input stays in the browser; it does not send email, submit leads, or save records to a server.
- A workspace preview under `/app`, with domain placeholders and compatibility routes for the original module URLs.
- Backend request validation, JWT verification, permission and active organization membership checks, sanitized errors, and health endpoints.
- A versioned 22-table MariaDB baseline and a containerized local development environment.

### Planned capabilities

Business CRUD, login and refresh flows, organization discovery, role seeds, dispatch actions, proof of delivery, resource ownership policies, COD reconciliation, ledger services, invoicing, and settlement remain to be implemented. Real-time updates, dispatch runs, commission calculations, and full double-entry accounting are blueprint concepts rather than completed services.

### Durable constraints

- Organization membership and permissions govern access. Each future business read and mutation must enforce organization scope; ordinary foreign keys do not provide tenant isolation by themselves.
- Driver access is intended to be limited to assigned work. Assigned-only permissions currently fail closed until ownership policies exist. The scaffold installs no default accounts or wildcard administrator bypass.
- Financial changes require matching ledger entries and transactionally consistent balances. Currency must retain decimal precision rather than use floating-point arithmetic.
- Staff and drivers share personnel concepts but have distinct operational responsibilities and records.
- Public product copy must distinguish working features, illustrative previews, and future capabilities. A workspace preview must not imply that live operational data or authenticated workflows are available.
- The existing React/Vite/daisyUI frontend and NestJS/TypeORM/MariaDB backend are the established implementation foundation. Domain boundaries and shared component conventions are documented in `.docs`.
- Docker Compose currently supports local development. Production hosting, HTTPS, and managed secrets are not delivered deployment capabilities.

### Terminology

**Client / merchant:** the business account shipping parcels. **Recipient:** the person receiving a parcel. **COD:** cash on delivery collected from a recipient. **POD:** proof of delivery. **RTS:** returned to sender. **Settlement:** resolving the merchant's net balance through a payout or payment due.

## Brand Commitments

The product name is **Transcend**. Existing public copy presents it as an accounting and delivery ERP and uses concrete language about operational handoffs and responsibilities.

The existing [DESIGN.md](DESIGN.md) is the visual reference and remains authoritative for visual work. Its payment-infrastructure references are stylistic references, not evidence that Transcend processes payments or has payment-network integrations. Product initialization does not replace or extend that design reference.

## Evidence on Hand

- [ERP product outline](.docs/ERP-Logistics-System-Outline-v1.md): intended domains, workflows, permissions, and role responsibilities.
- [Technical architecture](.docs/System-Technical-Architecture.md): established application boundaries and implementation status.
- [Data dictionary](.docs/Data-Dictionary-and-Entity-Relationship-Reference.md) and versioned migrations in `backend/src/database/migrations`: schema evidence, not proof that corresponding business services are implemented.
- [README](README.md) and [initial release notes](.docs/releases/0.1.0.md): setup, routes, scaffold scope, and recorded verification.
- `frontend/src/modules/marketing`: current public copy, illustrative workflows, and the browser-local operations brief.

No verified testimonials, customer logos, case studies, adoption figures, measured efficiency gains, pricing, or service-level guarantees have been supplied. Future content must not fabricate them.

## Product Principles

1. Connect delivery responsibility to financial responsibility through traceable records and handoffs.
2. Respect organization boundaries and role permissions throughout every workflow.
3. Preserve an auditable ledger when changing money or balances.
4. Keep personnel, fleet, dispatch, and finance responsibilities distinct while sharing the necessary context.
5. Describe the product's actual state honestly, including previews, unavailable actions, and planned functionality.

## Accessibility & Inclusion

The current frontend establishes keyboard navigation, a skip link, labeled form fields, field-level errors, status announcements, and reduced-motion handling. Preserve those behaviors as operational screens are introduced.

No product-specific accessibility compliance target, required assistive technology matrix, or localization requirement has been confirmed. Mobile browser access remains part of the web platform; no native app or offline delivery capability is established.

## Open Decisions

- Initial launch market, supported currencies, languages, and any right-to-left requirements.
- Priority and acceptance criteria for the first operational release beyond the scaffold.
- Pricing, licensing, production hosting, external integrations, and service commitments.
- Whether future scope includes merchant self-service, recipient tracking, offline workflows, or native applications.

These decisions remain open and must not be presented as approved requirements or delivered capabilities.
