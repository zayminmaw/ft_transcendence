# Transcend ERP — Database Schema Data Dictionary

* **Database Engine:** MariaDB 10.11 (InnoDB)
* **Default Charset / Collation:** `utf8mb4` / `utf8mb4_unicode_ci`

This document matches the 22-table baseline in `backend/src/database/migrations/initial-schema.sql`. Versioned migrations are authoritative; this dictionary and `maria-db-scheme-draft.sql` are reference snapshots. The TypeORM migration metadata table is separate from the domain tables.

Currency uses `DECIMAL(12, 2)`, dimensions/capacities use `DECIMAL(8, 2)`, and GPS coordinates retain their original precision. BIGINT IDs and monetary results remain strings in application code. All foreign keys have explicitly named indexes. Composite tenant foreign keys and scoped domain repositories still need implementation; ordinary foreign keys alone do not establish tenant isolation.

The required platform administration dashboard is planned. `organizations` represents tenants, `organization_members` models tenant membership, and `user_roles` reserves global role assignments. These tables do not implement platform authorization by themselves: current guards resolve organization membership, and dedicated platform permissions/policies, tenant-administrator assignment rules, and management auditing still need implementation. Tenant administrators must not be able to grant global platform roles. Review any supporting schema changes through new migrations; do not modify the applied baseline. See [the platform dashboard requirements](ERP-Logistics-System-Outline-v1.md#platform-administration-dashboard).

---

## 1. Authentication & RBAC

### Required provisioning behavior (planned)

Tenant onboarding must create an `organizations` row, its first administrator's `users` row, and an active `organization_members` row referencing the tenant-scoped `org_admin` role in one transaction. These records are required together; the schema's separate tables do not enforce that onboarding invariant automatically. Tenant administrator membership does not add a platform assignment to `user_roles`.

Usernames and emails are globally unique in the current baseline. A collision must not silently attach or overwrite an existing account. Additional company accounts require `admin.manage_users` and an allowed role/membership in the same tenant; there is no public signup. Store only password hashes and never include credentials in audit payloads. Session persistence (`user_sessions`) and the role and permission seeds exist; secure credential handover, password recovery, and provisioning services remain to be implemented; any additional schema support requires new migrations. See [Tenant onboarding and login flow](Tenant-Onboarding-and-Login-Flow.md).

### `users`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique user identifier |
| `username` | `VARCHAR(64)` | `NOT NULL`, `UNIQUE` | Unique login username |
| `email` | `VARCHAR(191)` | `NOT NULL`, `UNIQUE` | Login and recovery email |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Argon2id password hash |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Account active status flag |
| `last_login_at` | `TIMESTAMP` | `NULL` | Timestamp of most recent login |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Account creation date |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `ON UPDATE CURRENT_TIMESTAMP` | Last profile update |

### `roles`

Migration `1792195260000-AuthReferenceData` seeds `platform_admin`, `org_admin`, `dispatcher`, `hub_sorter`, `finance`, `hr_manager`, `fleet_lead`, and `driver`, with the 30 permission codes and default assignments from sections 4 and 5 of the [ERP outline](ERP-Logistics-System-Outline-v1.md). A `user_roles` row with `platform_admin` is what grants platform access.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Role identifier |
| `code` | `VARCHAR(64)` | `NOT NULL`, `UNIQUE` | Machine key (`super_admin`, `org_admin`, etc.) |
| `name` | `VARCHAR(128)` | `NOT NULL` | Human-readable role label |
| `description` | `VARCHAR(255)` | `NULL` | Functional summary of role scope |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation date |

### `permissions`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Permission identifier |
| `code` | `VARCHAR(64)` | `NOT NULL`, `UNIQUE` | Dot-notation key (`organizations.read`, etc.) |
| `module` | `VARCHAR(64)` | `NOT NULL` | Functional domain grouping |
| `description` | `VARCHAR(255)` | `NOT NULL` | Action description |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation date |

### `role_permissions`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `role_id` | `INT UNSIGNED` | `PK`, `FK -> roles.id` | Referenced role |
| `permission_id` | `INT UNSIGNED` | `PK`, `FK -> permissions.id` | Referenced permission |
| `scope` | `ENUM('all', 'assigned_only')` | `NOT NULL`, `DEFAULT 'all'` | Target record filter constraint |

### `user_roles`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `user_id` | `BIGINT UNSIGNED` | `PK`, `FK -> users.id` | Referenced user |
| `role_id` | `INT UNSIGNED` | `PK`, `FK -> roles.id` | Referenced global role |
| `assigned_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Assignment timestamp |

### `user_sessions`

Added by migrations `1792195200000-UserSessions`, `1792281600000-UserSessionFamily` and `1792454400000-UserSessionReuseInterval` (not in the baseline). One row per login on a device. The refresh token is `<familyId>.<secret>` and lives only in an httpOnly cookie scoped to `/api/auth`; the table stores the family id and SHA-256 hashes of the current and just-replaced secrets. Every refresh replaces the secret; the just-replaced secret remains usable for 10 seconds after rotation to tolerate a lost refresh response. Presenting any older secret, or the just-replaced secret after that interval, ends the session (`revoked_reason = 'reuse'`).

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Session identifier |
| `user_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> users.id` (`ON DELETE CASCADE`), indexed | Session owner |
| `family_id` | `CHAR(22)` | `NOT NULL`, `UNIQUE` | Random session id; first part of the refresh token |
| `token_hash` | `CHAR(64)` | `NOT NULL`, `UNIQUE` | SHA-256 (hex) of the current secret |
| `previous_token_hash` | `CHAR(64)` | `NULL` | SHA-256 (hex) of the just-replaced secret |
| `rotated_at` | `TIMESTAMP` | `NULL`, `DEFAULT NULL` | Start of the 10-second reuse interval; not extended by retries |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Login time |
| `last_used_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last refresh |
| `idle_expires_at` | `TIMESTAMP` | `NOT NULL` | Last use + 7 days, never past the absolute expiry |
| `absolute_expires_at` | `TIMESTAMP` | `NOT NULL` | Login + 30 days |
| `revoked_at` | `TIMESTAMP` | `NULL` | When the session ended early |
| `revoked_reason` | `VARCHAR(32)` | `NULL` | `logout`, `reuse`, or `inactive` |
| `user_agent` | `VARCHAR(255)` | `NULL` | Browser, for a future device list |
| `ip_address` | `VARCHAR(45)` | `NULL` | Client address at login |

---

## 2. Organizations & Tenant Memberships

### `organizations`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Organization primary key |
| `name` | `VARCHAR(191)` | `NOT NULL`, `INDEX` | Legal or trade business name |
| `slug` | `VARCHAR(64)` | `NOT NULL`, `UNIQUE` | URL/tenant identifier slug |
| `tax_id` | `VARCHAR(128)` | `NULL` | Organization tax registration number |
| `contact_email` | `VARCHAR(191)` | `NOT NULL` | Organization primary billing/admin email |
| `contact_phone` | `VARCHAR(32)` | `NULL` | Primary administrative phone |
| `address` | `TEXT` | `NULL` | Registered headquarters address |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Tenant operational status |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Organization creation date |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `ON UPDATE CURRENT_TIMESTAMP` | Last profile update |

### `organization_members`

A user may have memberships in multiple companies, with an independent role and active status in each. The baseline's unique `(organization_id, user_id)` pair prevents duplicate membership in the same company. The required post-login workspace picker lists only verified active memberships in active organizations; selection does not create membership. Scope application caches and retained state by identity and selected organization so switching never mixes company data. See [workspace selection and isolation requirements](Tenant-Onboarding-and-Login-Flow.md#company-workspace-picker-required-not-implemented). This describes planned application behavior, not a new schema migration.

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Membership record ID |
| `organization_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> organizations.id` | Scoped organization |
| `user_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> users.id` | Scoped user |
| `role_id` | `INT UNSIGNED` | `NOT NULL`, `FK -> roles.id` | User's role inside this organization |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Active membership flag |
| `joined_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Timestamp of membership grant |

---

### Planned contacts and presence data (not in the baseline)

The required contacts feature links an owning company member to another member in the same company. Planned persistence needs company context, owner/target membership references, uniqueness, and prevention of self contacts. New additions require active accounts/memberships and an allowed acting-role → target-role pairing in that organization. Group contacts by tenant role; departments are optional display/filter metadata. Once added, the saved contact includes status access without a separate role-based presence permission, subject to contact ownership and continued company access. Role changes alone do not hide saved-contact status.

No contacts table or presence storage is implemented in the 22-table baseline. Add new migrations for durable relationships; this description is not an applied schema. The only contact statuses are **Online**, **Offline**, and **Suspended**. Derive Suspended from target account/company-membership suspension before evaluating expiring company-session presence for Online/Offline. Retain an existing suspended target's relationship/status; permanent membership/contact removal ends access. Define suspension versus permanent removal explicitly in future service/schema contracts; the current `is_active` flags alone do not describe that lifecycle. Neither `users.last_login_at`, an account-global online flag, nor `drivers.dispatch_status` is the live-presence authority. Contact lists and presence caches must remain isolated between company workspaces. See [Company contacts and online status](Contacts-and-Online-Status.md).

## 3. Clients / Merchants CRM

### `clients`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Internal client identifier |
| `organization_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> organizations.id` | Owning organization |
| `client_code` | `VARCHAR(32)` | `NOT NULL` | Scoped merchant code |
| `business_name` | `VARCHAR(191)` | `NOT NULL`, `INDEX` | Business trading name |
| `trade_license_no` | `VARCHAR(128)` | `NULL` | Merchant tax/commercial registration |
| `contact_person_name` | `VARCHAR(128)` | `NOT NULL` | Main account contact |
| `contact_title` | `VARCHAR(64)` | `NULL` | Contact title |
| `mobile_1` | `VARCHAR(32)` | `NOT NULL`, `INDEX` | Primary phone contact |
| `mobile_2` | `VARCHAR(32)` | `NULL` | Secondary phone contact |
| `email` | `VARCHAR(191)` | `NOT NULL` | Merchant billing email |
| `billing_address` | `TEXT` | `NOT NULL` | Invoicing address |
| `default_pickup_address` | `TEXT` | `NOT NULL` | Pickup dispatch location |
| `pickup_latitude` | `DECIMAL(10, 8)` | `NULL` | Pickup GPS latitude |
| `pickup_longitude` | `DECIMAL(11, 8)` | `NULL` | Pickup GPS longitude |
| `current_balance` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Net running balance |
| `pending_cod_balance` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | In-transit unreconciled COD |
| `rate_profile_tier` | `VARCHAR(32)` | `NOT NULL`, `DEFAULT 'standard'` | Pricing tariff profile |
| `operational_notes` | `TEXT` | `NULL` | Merchant dispatch preferences |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Account status flag |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `ON UPDATE CURRENT_TIMESTAMP` | Last profile update |

---

## 4. Personnel & HR

### `employees`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique employee identifier |
| `organization_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> organizations.id` | Owning organization |
| `user_id` | `BIGINT UNSIGNED` | `NULL`, `UNIQUE`, `FK -> users.id` | Optional linked login account |
| `employee_code` | `VARCHAR(32)` | `NOT NULL` | Scoped employee badge ID |
| `first_name` | `VARCHAR(64)` | `NOT NULL` | First name |
| `last_name` | `VARCHAR(64)` | `NOT NULL` | Last name |
| `department` | `ENUM(...)` | `NOT NULL`, `INDEX` | Organizational division |
| `personnel_type` | `ENUM('internal_staff', 'driver')` | `NOT NULL`, `INDEX` | Staff discriminator |
| `employment_classification` | `ENUM(...)` | `NOT NULL` | Labor classification |
| `compensation_type` | `ENUM(...)` | `NOT NULL` | Payroll structure |
| `base_salary` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Fixed recurring wage rate |
| `bank_account_iban` | `VARCHAR(64)` | `NULL` | Payout IBAN / Account ID |
| `bank_name` | `VARCHAR(128)` | `NULL` | Direct deposit bank name |
| `national_id` | `VARCHAR(64)` | `NOT NULL` | Civil ID / SSN / Passport |
| `date_of_birth` | `DATE` | `NOT NULL` | Date of birth |
| `personal_mobile` | `VARCHAR(32)` | `NOT NULL` | Mobile telephone |
| `personal_email` | `VARCHAR(191)` | `NOT NULL` | Private email |
| `residential_address` | `TEXT` | `NOT NULL` | Home address |
| `emergency_contact_name` | `VARCHAR(128)` | `NOT NULL` | Emergency contact full name |
| `emergency_contact_phone`| `VARCHAR(32)` | `NOT NULL` | Emergency contact phone |
| `employment_status` | `ENUM(...)` | `NOT NULL`, `DEFAULT 'active'` | Employment status |
| `hire_date` | `DATE` | `NOT NULL` | Date of hire |
| `termination_date` | `DATE` | `NULL` | Date of departure |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `ON UPDATE CURRENT_TIMESTAMP` | Last profile update |

### `company_staff`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `employee_id` | `BIGINT UNSIGNED` | `PK`, `FK -> employees.id` | Base employee key |
| `job_title` | `VARCHAR(128)` | `NOT NULL` | Organizational position |
| `assigned_office_hub` | `VARCHAR(128)` | `NOT NULL` | Station or hub location |
| `shift_schedule` | `VARCHAR(64)` | `NULL` | Shift label |
| `reporting_manager_id` | `BIGINT UNSIGNED` | `NULL`, `FK -> employees.id` | Manager reference |
| `corporate_email` | `VARCHAR(191)` | `NULL` | Domain email |
| `internal_phone_ext` | `VARCHAR(16)` | `NULL` | Office phone extension |

### `delivery_drivers`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `employee_id` | `BIGINT UNSIGNED` | `PK`, `FK -> employees.id` | Base employee key |
| `driver_category` | `ENUM(...)` | `NOT NULL` | Vehicle operating specialization |
| `fleet_arrangement` | `ENUM(...)` | `NOT NULL` | Vehicle fleet ownership model |
| `commission_per_drop` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Completed delivery drop commission |
| `license_number` | `VARCHAR(64)` | `NOT NULL`, `UNIQUE` | Driving license number |
| `license_class` | `VARCHAR(32)` | `NOT NULL` | License qualification class |
| `license_expiry_date` | `DATE` | `NOT NULL` | License expiration deadline |
| `background_check_passed`| `BOOLEAN` | `NOT NULL`, `DEFAULT FALSE` | Background check flag |
| `background_check_date` | `DATE` | `NULL` | Date checked |
| `transit_insurance_policy`| `VARCHAR(64)` | `NULL` | Goods-in-transit policy number |
| `transit_insurance_expiry`| `DATE` | `NULL` | Policy expiration date |
| `assigned_zone` | `VARCHAR(64)` | `NULL`, `INDEX` | Assigned delivery zone |
| `max_weight_capacity_kg`| `DECIMAL(8, 2)` | `NOT NULL`, `DEFAULT 0.00` | Weight capacity |
| `max_volume_capacity_m3`| `DECIMAL(8, 2)` | `NOT NULL`, `DEFAULT 0.00` | Volume capacity |
| `dispatch_status` | `ENUM(...)` | `NOT NULL`, `DEFAULT 'off_duty'`, `INDEX` | Real-time courier dispatch status |
| `current_latitude` | `DECIMAL(10, 8)` | `NULL` | Telematics latitude |
| `current_longitude` | `DECIMAL(11, 8)` | `NULL` | Telematics longitude |
| `last_location_ping` | `TIMESTAMP` | `NULL` | Last GPS ping |

---

## 5. Fleet & Assets

### `assets`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Unique asset record identifier |
| `organization_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> organizations.id` | Owning organization |
| `asset_tag` | `VARCHAR(64)` | `NOT NULL` | Scoped inventory tag (`VAN-004`) |
| `asset_name` | `VARCHAR(128)` | `NOT NULL` | Asset label/make/model |
| `category` | `ENUM(...)` | `NOT NULL`, `INDEX` | Equipment classification |
| `acquisition_cost` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Original purchase price |
| `current_book_value` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Current book valuation |
| `license_plate` | `VARCHAR(32)` | `NULL` | Vehicle license plate |
| `vin` | `VARCHAR(64)` | `NULL` | Vehicle Identification Number |
| `insurance_policy_number`| `VARCHAR(64)` | `NULL` | Motor insurance policy |
| `road_tax_expiry` | `DATE` | `NULL` | Road tax / inspection deadline |
| `current_condition` | `ENUM(...)` | `NOT NULL`, `DEFAULT 'good'`, `INDEX` | Physical condition status |
| `notes` | `TEXT` | `NULL` | Operational notes |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Ingest timestamp |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `ON UPDATE CURRENT_TIMESTAMP` | Last profile update |

### `asset_assignments`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Assignment log ID |
| `asset_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> assets.id` | Assigned hardware/vehicle |
| `driver_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> delivery_drivers.employee_id` | Custodian courier |
| `checked_out_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Checkout timestamp |
| `checked_in_at` | `TIMESTAMP` | `NULL`, `INDEX` | Return timestamp |
| `checkout_notes` | `TEXT` | `NULL` | Condition notes on checkout |
| `checkin_notes` | `TEXT` | `NULL` | Condition notes on return |

### `asset_maintenance_logs`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Maintenance event ID |
| `asset_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> assets.id` | Serviced asset identifier |
| `service_date` | `DATE` | `NOT NULL` | Execution date of service |
| `service_type` | `VARCHAR(128)` | `NOT NULL` | Maintenance category/job |
| `service_cost` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Repair expense |
| `vendor_service_center` | `VARCHAR(128)` | `NULL` | External repair garage |
| `next_service_due` | `DATE` | `NULL` | Scheduled next service |
| `notes` | `TEXT` | `NULL` | Technician service notes |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Entry logging timestamp |

---

## 6. Parcels & Operations

### `parcels`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Parcel primary key |
| `organization_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> organizations.id` | Owning organization |
| `tracking_number` | `VARCHAR(64)` | `NOT NULL`, `UNIQUE` | Waybill barcode/QR scan value |
| `client_id` | `BIGINT UNSIGNED` | `NOT NULL`, `INDEX`, `FK -> clients.id` | Ordering merchant account |
| `assigned_driver_id` | `BIGINT UNSIGNED` | `NULL`, `INDEX`, `FK -> delivery_drivers.employee_id` | Dispatched courier |
| `assigned_asset_id` | `BIGINT UNSIGNED` | `NULL`, `FK -> assets.id` | Assigned vehicle |
| `recipient_name` | `VARCHAR(128)` | `NOT NULL` | Recipient customer name |
| `recipient_phone` | `VARCHAR(32)` | `NOT NULL` | Primary delivery telephone |
| `recipient_secondary_phone`| `VARCHAR(32)`| `NULL` | Alternative delivery contact |
| `delivery_address` | `TEXT` | `NOT NULL` | Destination delivery address |
| `delivery_city_zone` | `VARCHAR(64)` | `NOT NULL`, `INDEX` | City routing sector |
| `delivery_landmark` | `VARCHAR(128)` | `NULL` | Destination landmark |
| `delivery_latitude` | `DECIMAL(10, 8)` | `NULL` | Destination latitude |
| `delivery_longitude` | `DECIMAL(11, 8)` | `NULL` | Destination longitude |
| `weight_kg` | `DECIMAL(8, 2)` | `NOT NULL`, `DEFAULT 0.50` | Weight in kg |
| `length_cm` | `DECIMAL(8, 2)` | `NULL` | Length |
| `width_cm` | `DECIMAL(8, 2)` | `NULL` | Width |
| `height_cm` | `DECIMAL(8, 2)` | `NULL` | Height |
| `is_fragile` | `BOOLEAN` | `NOT NULL`, `DEFAULT FALSE` | Fragile handling flag |
| `package_type` | `VARCHAR(64)` | `NOT NULL`, `DEFAULT 'standard_box'` | Packaging format |
| `delivery_fee` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Fee billed to merchant |
| `cod_amount` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Doorstep COD collection |
| `declared_value` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Declared parcel content value |
| `is_insured` | `BOOLEAN` | `NOT NULL`, `DEFAULT FALSE` | Transit insurance flag |
| `insurance_fee` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Premium charged for insurance |
| `lifecycle_status` | `ENUM(...)` | `NOT NULL`, `DEFAULT 'draft'`, `INDEX` | Lifecycle status |
| `delivery_attempt_count`| `TINYINT UNSIGNED` | `NOT NULL`, `DEFAULT 0` | Failed attempts counter |
| `failed_reason_code` | `VARCHAR(64)` | `NULL` | Failure reason code |
| `recipient_signature_url`| `VARCHAR(255)` | `NULL` | Signature image URL |
| `doorstep_photo_url` | `VARCHAR(255)` | `NULL` | POD photo URL |
| `delivered_at` | `TIMESTAMP` | `NULL` | Completion timestamp |
| `delivered_latitude` | `DECIMAL(10, 8)` | `NULL` | POD latitude ping |
| `delivered_longitude` | `DECIMAL(11, 8)` | `NULL` | POD longitude ping |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Order intake date |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `ON UPDATE CURRENT_TIMESTAMP` | Last status modification |

### `parcel_events`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Event log identifier |
| `parcel_id` | `BIGINT UNSIGNED` | `NOT NULL`, `INDEX`, `FK -> parcels.id` | Associated parcel package |
| `actor_user_id` | `BIGINT UNSIGNED` | `NULL`, `FK -> users.id` | User or courier who triggered event |
| `status` | `ENUM(...)` | `NOT NULL` | Status applied during scan |
| `hub_location` | `VARCHAR(128)` | `NULL` | Scanning station or depot |
| `notes` | `TEXT` | `NULL` | Event notes |
| `event_timestamp` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`, `INDEX` | Event timestamp |

---

## 7. Financial Settlement & Balances

### `driver_cod_settlements`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Settlement sheet ID |
| `organization_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> organizations.id` | Scoped organization |
| `settlement_reference` | `VARCHAR(64)` | `NOT NULL`, `UNIQUE` | Shift drop code |
| `driver_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> delivery_drivers.employee_id` | Dispatched courier |
| `reconciled_by_user_id`| `BIGINT UNSIGNED` | `NOT NULL`, `FK -> users.id` | Verifying cashier/finance user |
| `total_cod_expected` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Sum of expected COD |
| `total_cash_dropped` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Cash turned into hub |
| `discrepancy_amount` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | `total_cash_dropped - total_cod_expected` |
| `settlement_status` | `ENUM(...)` | `NOT NULL`, `DEFAULT 'pending'` | Audit verification status |
| `reconciliation_notes` | `TEXT` | `NULL` | Reconciliation remarks |
| `settled_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Settlement sign-off timestamp |

### `driver_cod_collections`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Collection item identifier |
| `settlement_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> driver_cod_settlements.id` | Parent settlement sheet |
| `parcel_id` | `BIGINT UNSIGNED` | `NOT NULL`, `UNIQUE`, `FK -> parcels.id` | Associated delivered parcel |
| `amount_collected` | `DECIMAL(12, 2)` | `NOT NULL`, `DEFAULT 0.00` | Amount collected |
| `payment_method` | `ENUM(...)` | `NOT NULL`, `DEFAULT 'cash'` | Payment method |
| `collected_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Doorstep collection timestamp |

### `merchant_ledger_entries`

| Column | Data Type | Constraints | Description |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `PK`, `AUTO_INCREMENT` | Ledger journal sequence ID |
| `organization_id` | `BIGINT UNSIGNED` | `NOT NULL`, `FK -> organizations.id` | Owning organization |
| `client_id` | `BIGINT UNSIGNED` | `NOT NULL`, `INDEX`, `FK -> clients.id` | Scoped merchant account |
| `reference_type` | `ENUM(...)` | `NOT NULL` | Business event type |
| `reference_id` | `BIGINT UNSIGNED` | `NULL` | Contextual reference ID |
| `entry_type` | `ENUM('credit', 'debit')` | `NOT NULL` | Transaction direction |
| `amount` | `DECIMAL(12, 2)` | `NOT NULL` | Transaction amount |
| `balance_after` | `DECIMAL(12, 2)` | `NOT NULL` | Resulting running balance |
| `description` | `VARCHAR(255)` | `NOT NULL` | Narrative description |
| `created_by_user_id` | `BIGINT UNSIGNED` | `NULL`, `FK -> users.id` | Posting actor |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP`, `INDEX` | Posting timestamp |

---

## 8. Invoicing

### `invoices`

| Column | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | AUTO_INCREMENT PRIMARY KEY | Record identifier |
| `organization_id` | `BIGINT UNSIGNED` | NOT NULL; FK -> organizations.id | Owning or related organization |
| `invoice_number` | `VARCHAR(64)` | NOT NULL UNIQUE | Unique invoice reference |
| `client_id` | `BIGINT UNSIGNED` | NOT NULL; FK -> clients.id | Merchant billed or settled |
| `billing_period_start` | `DATE` | NOT NULL | First day of the billing period |
| `billing_period_end` | `DATE` | NOT NULL | Last day of the billing period |
| `total_deliveries` | `INT UNSIGNED` | NOT NULL DEFAULT 0 | Number of deliveries included |
| `total_delivery_fees` | `DECIMAL(12, 2)` | NOT NULL DEFAULT 0.00 | Total delivery service charges |
| `total_cod_collected` | `DECIMAL(12, 2)` | NOT NULL DEFAULT 0.00 | Total COD collected |
| `net_amount_due` | `DECIMAL(12, 2)` | NOT NULL DEFAULT 0.00 | Net invoice amount or merchant payout |
| `status` | `ENUM('draft', 'issued', 'paid_via_balance_offset', 'paid_via_bank_transfer', 'overdue')` | NOT NULL DEFAULT 'draft' | Billing/payment lifecycle state |
| `issue_date` | `DATE` | NOT NULL | Invoice issue date |
| `due_date` | `DATE` | NOT NULL | Payment deadline |
| `created_by_user_id` | `BIGINT UNSIGNED` | NOT NULL; FK -> users.id | User who created the record |
| `notes` | `TEXT` | NULL | Billing notes |
| `created_at` | `TIMESTAMP` | NOT NULL DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |
| `updated_at` | `TIMESTAMP` | NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last record update timestamp |

### `invoice_items`

| Column | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | AUTO_INCREMENT PRIMARY KEY | Record identifier |
| `invoice_id` | `BIGINT UNSIGNED` | NOT NULL; FK -> invoices.id | Parent invoice |
| `parcel_id` | `BIGINT UNSIGNED` | NOT NULL UNIQUE; FK -> parcels.id | Included parcel; unique to one invoice line |
| `delivery_fee` | `DECIMAL(12, 2)` | NOT NULL | Parcel delivery charge |
| `cod_amount` | `DECIMAL(12, 2)` | NOT NULL | Parcel COD amount |
| `surcharges` | `DECIMAL(12, 2)` | NOT NULL DEFAULT 0.00 | Additional parcel charges |
| `net_item_amount` | `DECIMAL(12, 2)` | NOT NULL | Net billed amount for this invoice line |

## 9. Audit logging

### `audit_logs`

| Column | Data Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | AUTO_INCREMENT PRIMARY KEY | Record identifier |
| `organization_id` | `BIGINT UNSIGNED` | NULL; FK -> organizations.id | Owning or related organization |
| `user_id` | `BIGINT UNSIGNED` | NULL; FK -> users.id | Acting user, if available |
| `module` | `VARCHAR(64)` | NOT NULL | Domain that generated the audit event |
| `action` | `VARCHAR(64)` | NOT NULL | Action performed |
| `record_id` | `VARCHAR(64)` | NULL | Affected record reference |
| `ip_address` | `VARCHAR(45)` | NULL | Originating IP address |
| `user_agent` | `VARCHAR(255)` | NULL | Originating client user agent |
| `old_values` | `JSON` | NULL | Previous values as JSON |
| `new_values` | `JSON` | NULL | New values as JSON |
| `created_at` | `TIMESTAMP` | NOT NULL DEFAULT CURRENT_TIMESTAMP | Record creation timestamp |

## 10. Explicit indexes and composite keys

These definitions are taken from the baseline. A composite unique key applies to the combination of columns.

### `users`



### `roles`



### `permissions`



### `role_permissions`

- `PRIMARY KEY (role_id, permission_id)`
- `INDEX idx_role_permissions_role_id (role_id)`
- `INDEX idx_role_permissions_permission_id (permission_id)`

### `user_roles`

- `PRIMARY KEY (user_id, role_id)`
- `INDEX idx_user_roles_user_id (user_id)`
- `INDEX idx_user_roles_role_id (role_id)`

### `organizations`

- `INDEX idx_org_name (name)`

### `organization_members`

- `UNIQUE KEY uq_org_user (organization_id, user_id)`
- `INDEX idx_organization_members_organization_id (organization_id)`
- `INDEX idx_organization_members_user_id (user_id)`
- `INDEX idx_organization_members_role_id (role_id)`

### `clients`

- `UNIQUE KEY uq_org_client_code (organization_id, client_code)`
- `INDEX idx_clients_business_name (business_name)`
- `INDEX idx_clients_mobile (mobile_1)`
- `INDEX idx_clients_organization_id (organization_id)`
- `INDEX idx_clients_code (client_code)`

### `employees`

- `UNIQUE KEY uq_org_employee_code (organization_id, employee_code)`
- `INDEX idx_emp_dept (department)`
- `INDEX idx_emp_type (personnel_type)`
- `INDEX idx_employees_organization_id (organization_id)`
- `INDEX idx_employees_user_id (user_id)`

### `company_staff`

- `INDEX idx_company_staff_employee_id (employee_id)`
- `INDEX idx_company_staff_reporting_manager_id (reporting_manager_id)`

### `delivery_drivers`

- `INDEX idx_driver_status (dispatch_status)`
- `INDEX idx_driver_zone (assigned_zone)`
- `INDEX idx_delivery_drivers_employee_id (employee_id)`

### `assets`

- `UNIQUE KEY uq_org_asset_tag (organization_id, asset_tag)`
- `INDEX idx_asset_category (category)`
- `INDEX idx_asset_condition (current_condition)`
- `INDEX idx_assets_organization_id (organization_id)`

### `asset_assignments`

- `INDEX idx_aa_active (asset_id, checked_in_at)`
- `INDEX idx_asset_assignments_asset_id (asset_id)`
- `INDEX idx_asset_assignments_driver_id (driver_id)`

### `asset_maintenance_logs`

- `INDEX idx_asset_maintenance_logs_asset_id (asset_id)`

### `parcels`

- `INDEX idx_parcels_status (lifecycle_status)`
- `INDEX idx_parcels_client (client_id)`
- `INDEX idx_parcels_driver (assigned_driver_id)`
- `INDEX idx_parcels_zone (delivery_city_zone)`
- `INDEX idx_parcels_organization_id (organization_id)`
- `INDEX idx_parcels_client_id (client_id)`
- `INDEX idx_parcels_assigned_driver_id (assigned_driver_id)`
- `INDEX idx_parcels_assigned_asset_id (assigned_asset_id)`

### `parcel_events`

- `INDEX idx_pe_parcel_ts (parcel_id, event_timestamp)`
- `INDEX idx_parcel_events_parcel_id (parcel_id)`
- `INDEX idx_parcel_events_actor_user_id (actor_user_id)`

### `driver_cod_settlements`

- `INDEX idx_driver_cod_settlements_organization_id (organization_id)`
- `INDEX idx_driver_cod_settlements_driver_id (driver_id)`
- `INDEX idx_driver_cod_settlements_reconciled_by_user_id (reconciled_by_user_id)`

### `driver_cod_collections`

- `INDEX idx_driver_cod_collections_settlement_id (settlement_id)`
- `INDEX idx_driver_cod_collections_parcel_id (parcel_id)`

### `merchant_ledger_entries`

- `INDEX idx_mle_client_created (client_id, created_at)`
- `INDEX idx_merchant_ledger_entries_organization_id (organization_id)`
- `INDEX idx_merchant_ledger_entries_client_id (client_id)`
- `INDEX idx_merchant_ledger_entries_created_by_user_id (created_by_user_id)`

### `invoices`

- `INDEX idx_inv_client (client_id)`
- `INDEX idx_inv_status (status)`
- `INDEX idx_invoices_organization_id (organization_id)`
- `INDEX idx_invoices_client_id (client_id)`
- `INDEX idx_invoices_created_by_user_id (created_by_user_id)`

### `invoice_items`

- `INDEX idx_invoice_items_invoice_id (invoice_id)`
- `INDEX idx_invoice_items_parcel_id (parcel_id)`

### `audit_logs`

- `INDEX idx_al_module (module)`
- `INDEX idx_al_created (created_at)`
- `INDEX idx_audit_logs_organization_id (organization_id)`
- `INDEX idx_audit_logs_user_id (user_id)`

## 11. Foreign-key relationship reference

| Source | Target | On delete | Constraint |
| --- | --- | --- | --- |
| `role_permissions.role_id` | `roles.id` | CASCADE | `fk_rp_role` |
| `role_permissions.permission_id` | `permissions.id` | CASCADE | `fk_rp_perm` |
| `user_roles.user_id` | `users.id` | CASCADE | `fk_ur_user` |
| `user_roles.role_id` | `roles.id` | CASCADE | `fk_ur_role` |
| `organization_members.organization_id` | `organizations.id` | CASCADE | `fk_om_org` |
| `organization_members.user_id` | `users.id` | CASCADE | `fk_om_user` |
| `organization_members.role_id` | `roles.id` | RESTRICT | `fk_om_role` |
| `clients.organization_id` | `organizations.id` | CASCADE | `fk_clients_org` |
| `employees.organization_id` | `organizations.id` | CASCADE | `fk_emp_org` |
| `employees.user_id` | `users.id` | SET NULL | `fk_emp_user` |
| `company_staff.employee_id` | `employees.id` | CASCADE | `fk_staff_employee` |
| `company_staff.reporting_manager_id` | `employees.id` | SET NULL | `fk_staff_manager` |
| `delivery_drivers.employee_id` | `employees.id` | CASCADE | `fk_driver_employee` |
| `assets.organization_id` | `organizations.id` | CASCADE | `fk_assets_org` |
| `asset_assignments.asset_id` | `assets.id` | CASCADE | `fk_aa_asset` |
| `asset_assignments.driver_id` | `delivery_drivers.employee_id` | CASCADE | `fk_aa_driver` |
| `asset_maintenance_logs.asset_id` | `assets.id` | CASCADE | `fk_aml_asset` |
| `parcels.organization_id` | `organizations.id` | CASCADE | `fk_parcel_org` |
| `parcels.client_id` | `clients.id` | RESTRICT | `fk_parcel_client` |
| `parcels.assigned_driver_id` | `delivery_drivers.employee_id` | SET NULL | `fk_parcel_driver` |
| `parcels.assigned_asset_id` | `assets.id` | SET NULL | `fk_parcel_asset` |
| `parcel_events.parcel_id` | `parcels.id` | CASCADE | `fk_pe_parcel` |
| `parcel_events.actor_user_id` | `users.id` | SET NULL | `fk_pe_user` |
| `driver_cod_settlements.organization_id` | `organizations.id` | CASCADE | `fk_dcs_org` |
| `driver_cod_settlements.driver_id` | `delivery_drivers.employee_id` | RESTRICT | `fk_dcs_driver` |
| `driver_cod_settlements.reconciled_by_user_id` | `users.id` | RESTRICT | `fk_dcs_user` |
| `driver_cod_collections.settlement_id` | `driver_cod_settlements.id` | CASCADE | `fk_dcc_settlement` |
| `driver_cod_collections.parcel_id` | `parcels.id` | RESTRICT | `fk_dcc_parcel` |
| `merchant_ledger_entries.organization_id` | `organizations.id` | CASCADE | `fk_mle_org` |
| `merchant_ledger_entries.client_id` | `clients.id` | RESTRICT | `fk_mle_client` |
| `merchant_ledger_entries.created_by_user_id` | `users.id` | SET NULL | `fk_mle_user` |
| `invoices.organization_id` | `organizations.id` | CASCADE | `fk_inv_org` |
| `invoices.client_id` | `clients.id` | RESTRICT | `fk_inv_client` |
| `invoices.created_by_user_id` | `users.id` | RESTRICT | `fk_inv_user` |
| `invoice_items.invoice_id` | `invoices.id` | CASCADE | `fk_ii_invoice` |
| `invoice_items.parcel_id` | `parcels.id` | RESTRICT | `fk_ii_parcel` |
| `audit_logs.organization_id` | `organizations.id` | SET NULL | `fk_al_org` |
| `audit_logs.user_id` | `users.id` | SET NULL | `fk_al_user` |

## 12. Domain integrity

Merchant balance mutations and their ledger entries must execute in the same ACID transaction. Validate client, employee/driver, asset, invoice, and settlement references against the active organization. Assigned-only permissions need resource ownership policies before access is enabled. Default roles and wildcard behavior in the ERP outline remain planned, not seeded.
