# Transcend — Last-Mile Delivery & Courier ERP Specification

## Implementation status

This document defines the target product, not a list of completed features. The repository currently contains a NestJS security/database foundation, mirrored domain module skeletons, a React/Vite workspace preview, and public marketing pages styled with Tailwind CSS 4 and daisyUI 5. Business CRUD, login/refresh, role seeds, operational delivery actions, and financial services remain to be implemented.

The public website has landing (`/`), product (`/product`), solutions (`/solutions`), and rollout planning (`/contact`) pages in the frontend-only `marketing` module. The rollout planner validates input and downloads a browser-local brief; it does not submit leads or emails. The workspace lives under `/app`, with the original module URLs retained for compatibility.

Required next surfaces include public privacy/terms-of-service pages, an authenticated tenant portal, and a separate authenticated platform administration dashboard. The current workspace is a public preview; portal route protection and platform dashboard services remain to be implemented.

Use the current data dictionary and versioned backend migrations for exact implemented schema types. Currency is standardized on `DECIMAL(12,2)`, while package dimensions and capacities use `DECIMAL(8,2)`. The baseline does not yet include every concept in this product outline, such as a dispatch-run entity or commission calculation services.

JWT and permission guards are global. Active membership is resolved by the permission guard before the tenant interceptor, and assigned-only access is denied until record ownership policies exist. The role table below describes intended defaults; no wildcard super-admin bypass or default role assignments are currently installed.

## 1. System Overview

Transcend is a centralized ERP and operations platform tailored for courier, parcel delivery, and last-mile dispatch businesses. The system coordinates parcels, office personnel, delivery drivers, merchant (client) accounts, fleet assets, automated cash-on-delivery (COD) reconciliation, and merchant balance ledgers within a secure, role-based environment.

Each tenant is a courier organization using the service. Platform administrators manage tenants across the platform; tenant administrators manage their own organization's users, employees, roles, and permissions. Merchants are client records inside a tenant, not tenants themselves.

### Platform Administration Dashboard

**Status:** Required, not implemented. This is a separate platform-owner area from tenant administration.

- List and create tenants; view and update their organization/contact details.
- Activate, suspend, and reactivate tenants without deleting their operational or accounting history.
- Assign or revoke tenant administrators without granting platform permissions to tenant users.
- Monitor tenant status, membership summaries, and tenant-management activity; review auditable management events.
- Record the platform actor, target tenant, action, and outcome for management changes and monitoring access.

**Access boundary:** Require authentication and explicit platform permissions. Tenant administrators can manage users/employees and allowed role/permission assignments only within their own tenant. Platform tenant-management access does not automatically expose tenant payroll, ledgers, or parcel records. Suspension must deny tenant access while leaving authorized platform management available. Exact monitoring metrics and platform routes remain to be agreed.

## 2. Core Entities & Relational Architecture

* **Clients (Merchants):** Maintain a running ledger balance. Shipments debit delivery fees and credit collected COD amounts.
* **Personnel (HR):** Uses a shared personal profile but branches strictly into **Internal Company Staff** (office, HR, accounting, dispatch) and **Delivery Drivers** (field couriers, licensing, vehicle pairings, runs).
* **Parcels:** Linked to a Merchant, an assigned Driver, and optional Asset (vehicle). Track real-time delivery milestones and proof of delivery (POD).
* **Invoices & Settlements:** Itemize delivery charges and COD payouts, updating the merchant's running balance.
* **Assets:** Tracks vehicles, delivery bags, and mobile scanners assigned to drivers or hubs.

## 3. Core Pages & Modules

### A. Client Page (Merchant CRM & Ledger)

* **Purpose:** Centralized directory of business clients (e-commerce merchants, retailers, corporate accounts) and their live balances.
* **Key Data Displayed:**
  * Company Name, Commercial Reg / Tax ID
  * Primary Contact Person, Mobile 1, Mobile 2, Email
  * Default Pickup Address & Geolocation Coordinates
  * Current Balance Ledger (Live Balance, Pending COD, Unbilled Fees)
  * Custom Parcel Rate Profile & Operational Notes

### B. Personnel & HR Page

To properly handle different operational responsibilities, personnel records share core identity data while separating back-office staff from field couriers.

#### 1. Core Profile (All Personnel)

* Employee ID, Full Legal Name, National ID / SSN, Date of Birth
* Contact Details (Mobile, Personal Email, Address) & Emergency Contact
* Employment Type (`Full-time`, `Part-time`, `Contractor`, `Owner`)
* Base Compensation / Bank Details & Status (`Active`, `On Leave`, `Terminated`)

#### 2. Internal Company Staff View (HR, Accounting, Dispatch, Management)

* Job Title (e.g., `HR Generalist`, `Accountant`, `Dispatcher`, `Hub Supervisor`)
* Department (`Executive`, `HR`, `Finance`, `Operations`)
* Assigned Hub / Office Location & Shift Schedule
* Reporting Manager & Corporate Email / System User Account Link

#### 3. Delivery Drivers View (Couriers)

* Driver Category (`Motorcycle Courier`, `Van Driver`, `Truck Driver`, `Bicycle Courier`)
* Fleet Model (`Company Fleet`, `Owner-Operator / Personal Vehicle`)
* Pay Structure (`Hourly/Base`, `Per-Drop Commission`, `Hybrid`)
* Compliance: Driver's License Number, Class, Expiry, Background Check Status
* Assigned Vehicle / Asset & Active Route Zone
* Live Duty Status (`Off Duty`, `Available`, `Out for Delivery`, `Suspended`)

### C. Assets Page (Fleet & Hardware Tracking)

* **Purpose:** Lifecycle management for physical transport and warehouse hardware.
* **Key Data Displayed:**
  * Asset ID, Name, and Category (`Motorcycle`, `Van`, `Delivery Bag`, `Barcode Scanner`, `Mobile POS`)
  * Acquisition Cost, Current Valuation, and Condition
  * Vehicle Details (Plate Number, VIN, Insurance & Road Tax Expiry)
  * Current Custodian / Assigned Driver & Maintenance History

### D. Parcels & Deliveries Page

* **Purpose:** Dispatch and tracking engine for individual package lifecycles.
* **Key Data Displayed:**
  * Tracking / Waybill Number (Barcode / QR readable)
  * Linked Merchant Account & Recipient Details (Name, Phone, Address, Geolocation)
  * Package Specs: Weight, Dimensions, Package Type, Fragile Flag
  * Financials: Delivery Fee (billed to merchant) & COD Amount (collected from recipient)
  * Assigned Driver, Assigned Vehicle, and Dispatch Run ID
  * Parcel Status: `Pickup Scheduled` → `Picked Up` → `In Hub / Sorted` → `Out for Delivery` → `Delivered` → `Failed Attempt` → `Returned to Sender (RTS)`
  * Proof of Delivery (POD): Signature capture, Doorstep Photo, Delivery Geolocation ping, and Failure Reason Codes

### E. Invoices & Client Balances Page

* **Purpose:** Billing, balance ledger accounting, and COD settlement management.
* **Balance Accounting Flow:**
  * **Credits (+):** Cash on Delivery (COD) collected from recipients at doorstep by drivers, or direct merchant deposits.
  * **Debits (-):** Parcel delivery service fees, return charges, packaging fees, or manual chargebacks.
  * **Settlement:** Net-positive balances are paid out to merchants; net-negative balances are invoiced for payment.
* **Key Data Displayed:**
  * Invoice ID, Billing Period, Issue Date, Due Date
  * Linked Merchant & Itemized Parcel List (Tracking IDs, Delivery Fees, COD Collected)
  * Net Amount Due / Net Payout to Merchant
  * Payment Status: `Draft`, `Issued`, `Settled via Balance`, `Paid via Bank Transfer`, `Overdue`
  * Driver Cash Reconciliation Drop-Sheets (verifying driver collected COD before balance credit)

### F. User Management & Access Control (RBAC) Page

* **Purpose:** Tenant administrative interface to manage its own system logins, assign roles, and audit operations.
* **Key Features:** Organization memberships, user accounts linked to Personnel IDs, granular permissions, session management, and audit logging. Tenant administrators cannot assign platform roles or manage other tenants.

## 4. Granular Permission Schema

| Module | Permission Code | Description |
|---|---|---|
| **Clients** | `clients.view` | View client profiles and contact directories |
| | `clients.create` | Add new merchant accounts |
| | `clients.edit` | Update merchant terms, rates, and contact details |
| | `clients.delete` | Archive or deactivate client records |
| | `clients.view_financials` | View client live balance, rates, and ledgers |
| **Parcels** | `parcels.view` | View parcel tracking and run lists |
| | `parcels.create` | Create individual or bulk upload parcel waybills |
| | `parcels.dispatch` | Assign parcels to drivers and generate run sheets |
| | `parcels.update_status` | Update operational parcel status (Sort, In Hub, RTS) |
| | `parcels.mark_delivered` | Submit proof-of-delivery (photo, signature, notes) |
| | `parcels.override_fee` | Modify delivery charges or COD amounts on parcels |
| **HR & Staff** | `staff.view` | View internal office staff directory |
| | `staff.manage` | Onboard, edit, and offboard office staff |
| | `staff.view_payroll` | View office staff salaries and banking data |
| **Drivers** | `drivers.view` | View driver list, contact numbers, and duty statuses |
| | `drivers.manage` | Onboard drivers, configure commission rates, update licenses |
| | `drivers.view_compliance` | View driver licenses, background checks, and expirations |
| | `drivers.view_earnings` | View driver commissions and payout records |
| **Assets** | `assets.view` | View fleet inventory and assigned equipment |
| | `assets.create` | Add new vehicles, bikes, and scanners |
| | `assets.assign` | Check-in / check-out equipment to drivers |
| | `assets.log_maintenance` | Record servicing, repairs, and inspection dates |
| **Billing** | `billing.view` | View client balances and invoice lists |
| | `billing.reconcile_cod` | Approve driver daily COD handovers |
| | `billing.create_invoice` | Generate itemized billing statements |
| | `billing.adjust_balance` | Post manual ledger adjustments or payout records |
| | `billing.export` | Export financial ledgers and settlement reports |
| **Admin** | `admin.manage_users` | Create user accounts and link to employee profiles |
| | `admin.manage_roles` | Create and edit role permission mappings |
| | `admin.audit_logs` | View operational and financial audit logs |

## 5. Default Role-Permission Assignments

| Role Name | Assigned Permissions | Scope / Notes |
|---|---|---|
| **Platform Admin** | Explicit platform tenant-management permissions; exact codes to be agreed | Cross-tenant organization administration and monitoring; no automatic access to tenant business records |
| **Tenant Admin (`org_admin`)** | Explicit organization-scoped administration permissions | Manage its own organization's users, employees, memberships, and allowed role/permission assignments; no platform authority |
| **Dispatcher** | `clients.view`, `clients.create`, `clients.edit`, `parcels.view`, `parcels.create`, `parcels.dispatch`, `parcels.update_status`, `parcels.mark_delivered`, `drivers.view`, `assets.view`, `assets.assign` | Route management and fleet assignment; no payroll, billing, or audit access |
| **Hub Sorter** | `parcels.view`, `parcels.update_status` | Inbound intake, sorting, and hub transfer verification only |
| **Finance** | `clients.view`, `clients.create`, `clients.view_financials`, `parcels.view`, `parcels.override_fee`, `staff.view_payroll`, `drivers.view`, `drivers.view_earnings`, `billing.view`, `billing.reconcile_cod`, `billing.create_invoice`, `billing.adjust_balance`, `billing.export`, `admin.audit_logs` | Financial ledger control, COD settlement, invoicing, and payroll audit |
| **HR Manager** | `staff.view`, `staff.manage`, `staff.view_payroll`, `drivers.view`, `drivers.manage`, `drivers.view_compliance`, `drivers.view_earnings` | Personnel management, driver onboarding, compliance docs, and payroll records |
| **Fleet Lead** | `drivers.view`, `drivers.view_compliance`, `assets.view`, `assets.create`, `assets.assign`, `assets.log_maintenance` | Vehicle inventory, inspection schedules, maintenance logs, and driver licensing compliance |
| **Courier / Driver** | `parcels.view`, `parcels.update_status`, `parcels.mark_delivered`, `drivers.view_earnings` | Scoped strictly to assigned run sheet and personal commission summary |
