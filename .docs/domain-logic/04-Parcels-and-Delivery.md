# Parcels and Delivery Operations

**Status:** Authoritative domain logic and operational specification synthesized from `.docs/` architectural requirements, database schema migrations, and courier operational workflows.

Transcend's parcel domain is the core operational engine of the courier ERP. It coordinates parcel intake, waybill generation, hub sorting, driver dispatch, mobile field delivery, proof of delivery (POD) capture, failed attempts, and returns to sender (RTS).

---

## 1. Domain Entities & Responsibilities

| Table | Scope | Key Attributes |
| --- | --- | --- |
| `parcels` | Individual shipment waybill | `tracking_number`, `client_id`, `assigned_driver_id`, `assigned_asset_id`, `lifecycle_status`, `delivery_fee`, `cod_amount`, `weight_kg`, `delivery_attempt_count`, `recipient_signature_url`, `doorstep_photo_url`, `delivered_at` |
| `parcel_events` | Append-only lifecycle audit | `parcel_id`, `actor_user_id`, `status`, `hub_location`, `notes`, `event_timestamp` |
| `storage_files` | Evidence file custody | `organization_id`, `stored_name`, `original_name`, `mime_type`, `size_bytes` |

---

## 2. Core Domain Rules & Business Invariants

| Rule ID | Rule Definition | Invariant & Enforcement |
| --- | --- | --- |
| **PAR-01** | **Global Tracking Uniqueness** | `tracking_number` is globally unique across all tenants. A parcel belongs to exactly one tenant (`organization_id`) and one merchant (`client_id`). |
| **PAR-02** | **Tenant Boundary Integrity** | The ordering merchant (`client_id`), dispatched courier (`assigned_driver_id`), assigned vehicle (`assigned_asset_id`), and proof files must belong to the parcel's verified `organization_id`. Cross-tenant assignment is strictly rejected. |
| **PAR-03** | **Required Granular Permissions** | - Creation & bulk intake: `parcels.create`<br>- Viewing directory & tracking: `parcels.view`<br>- Dispatch & driver assignment: `parcels.dispatch`<br>- Operational transitions (Pick up, Sort, RTS): `parcels.update_status`<br>- Delivery & POD submission: `parcels.mark_delivered`<br>- Financial fee overrides: `parcels.override_fee` |
| **PAR-04** | **Driver Identification Model** | The driver reference is `delivery_drivers.employee_id` (an employee identity), **not** a login `user_id`. When drivers act in the field, the system resolves the driver's employee record from the authenticated user. |
| **PAR-05** | **Atomic Event Recording** | Every status modification to `parcels.lifecycle_status` must atomically insert a milestone record into `parcel_events` and an auditable entry into `audit_logs` in the same database transaction. |
| **PAR-06** | **Terminal States Immutability** | `delivered` and `returned_to_sender` are terminal operational states. Once reached, standard status update endpoints cannot alter the status. Any exceptional correction requires a dedicated, auditable supervisor override with financial reconciliation. |
| **PAR-07** | **Separation of Delivery & Cash Verification** | Marking a parcel as `delivered` records physical package handover and door collection facts. It **does not** mark cash as verified or credit merchant available balance. Verification occurs through cashier reconciliation in the billing domain. |

---

## 3. Parcel Lifecycle State Machine

Transcend enforces an explicit 8-state finite state machine:

```mermaid
stateDiagram-v2
    [*] --> draft: Save draft order
    draft --> pickup_scheduled: Complete required fields
    pickup_scheduled --> picked_up: Driver / Runner scans pickup
    picked_up --> in_hub_sorted: Hub sorter scans intake
    in_hub_sorted --> out_for_delivery: Dispatcher assigns driver & vehicle
    
    out_for_delivery --> delivered: Successful delivery (POD captured)
    out_for_delivery --> failed_attempt: Failed attempt (Reason logged)
    
    failed_attempt --> out_for_delivery: Dispatcher authorizes reattempt
    failed_attempt --> in_hub_sorted: Return to hub for rescheduling
    failed_attempt --> returned_to_sender: Max attempts reached / Sender cancels
    
    delivered --> [*]
    returned_to_sender --> [*]
```

### Transition Matrix & Preconditions

| From State | Allowed To State | Trigger / Command | Preconditions & System Validations |
| --- | --- | --- | --- |
| *New* | `draft` | `POST /api/parcels` | Valid merchant in same tenant; basic recipient name and city zone. |
| `draft` | `pickup_scheduled` | `PATCH /api/parcels/:id/schedule` | Complete delivery address, valid phone number, package weight > 0, non-negative delivery fee and COD amount. |
| `pickup_scheduled`| `picked_up` | `PATCH /api/parcels/:id/status` | Courier takes custody at merchant address. Inserts pickup event with actor ID. |
| `picked_up` | `in_hub_sorted` | `PATCH /api/parcels/:id/status` | Package scanned at depot. Records `hub_location`. Package sorted for zone. |
| `in_hub_sorted` | `out_for_delivery`| `POST /api/parcels/:id/dispatch` | Driver must be active, license valid, background passed, and duty status `available`. Vehicle must not be decommissioned. Increments merchant `pending_cod_balance`. |
| `out_for_delivery`| `delivered` | `POST /api/parcels/:id/mark-delivered` | Signature and/or doorstep photo uploaded to `storage_files`. GPS ping captured. Records completion timestamp `delivered_at`. |
| `out_for_delivery`| `failed_attempt` | `POST /api/parcels/:id/fail-attempt` | Valid `failed_reason_code` provided. Increments `delivery_attempt_count` by 1. |
| `failed_attempt` | `out_for_delivery`| `POST /api/parcels/:id/dispatch` | Reattempt approved by dispatcher. `delivery_attempt_count` preserved. |
| `failed_attempt` | `in_hub_sorted` | `PATCH /api/parcels/:id/status` | Driver returns un-delivered parcel to depot at end of shift. |
| `failed_attempt` | `returned_to_sender`| `POST /api/parcels/:id/return` | Authorized return. Physical handover back to merchant pickup address. Decrements merchant `pending_cod_balance`. Optional return fee debited. |

---

## 4. Operational User & System Flows

### Flow A: Parcel Intake & Waybill Creation

```mermaid
sequenceDiagram
    autonumber
    actor User as Merchant / Dispatcher
    actor Web as Transcend Portal
    participant API as Parcels API
    participant DB as MariaDB

    User->>Web: Navigates to /app/parcels/new
    User->>Web: Fills Merchant, Recipient, Address, Package Specs, Fee & COD
    Web->>API: POST /api/parcels (ParcelCreateDto)
    API->>API: Validate permissions (parcels.create) & Tenant Context
    API->>DB: Verify client_id belongs to organization_id & is_active
    API->>API: Generate unique tracking_number (e.g., TRK-2026-XXXXXX)
    API->>DB: BEGIN TRANSACTION
    API->>DB: INSERT into parcels (organization_id, tracking_number, client_id, lifecycle_status='pickup_scheduled', ...)
    API->>DB: INSERT into parcel_events (parcel_id, actor_user_id, status='pickup_scheduled')
    API->>DB: INSERT into audit_logs (module='parcels', action='create')
    API->>DB: COMMIT TRANSACTION
    API-->>Web: 201 Created (Parcel Details & Tracking Label URL)
    Web-->>User: Displays Waybill with Barcode / QR
```

#### Intake Validations:
- **Recipient Contact:** `recipient_name` required, `recipient_phone` normalized (E.164 or local format), `delivery_address` and `delivery_city_zone` mandatory.
- **Physical Specifications:** `weight_kg` must be $> 0.00$ (default $0.50$ kg). Dimensions (`length_cm`, `width_cm`, `height_cm`) must be $\ge 0$ if provided.
- **Financial Terms:** `delivery_fee` $\ge 0.00$, `cod_amount` $\ge 0.00$. If `is_insured = TRUE`, `declared_value` must be $> 0.00$ and `insurance_fee` $\ge 0.00$.

---

### Flow B: Hub Sorting & Driver Dispatch Run

```mermaid
sequenceDiagram
    autonumber
    actor Dispatcher as Hub Dispatcher
    participant API as Dispatch API
    participant DB as MariaDB

    Dispatcher->>API: GET /api/parcels/ready-for-dispatch?zone=Zone-East
    API->>DB: SELECT parcels WHERE lifecycle_status IN ('in_hub_sorted', 'failed_attempt') AND delivery_city_zone = 'Zone-East'
    API-->>Dispatcher: List of ready parcels
    Dispatcher->>API: GET /api/drivers/available?zone=Zone-East
    API->>DB: SELECT drivers JOIN employees WHERE dispatch_status = 'available' AND license_expiry_date >= TODAY AND background_check_passed = 1
    API-->>Dispatcher: List of compliant drivers & active assets
    Dispatcher->>API: POST /api/parcels/dispatch (parcel_ids: [101, 102], driver_id: 15, asset_id: 4)
    
    API->>DB: BEGIN TRANSACTION
    loop For each parcel_id
        API->>DB: SELECT * FROM parcels WHERE id = :id FOR UPDATE
        API->>DB: UPDATE parcels SET lifecycle_status = 'out_for_delivery', assigned_driver_id = 15, assigned_asset_id = 4
        API->>DB: INSERT parcel_events (parcel_id, status='out_for_delivery', actor_user_id)
        API->>DB: UPDATE clients SET pending_cod_balance = pending_cod_balance + cod_amount WHERE id = parcel.client_id
    end
    API->>DB: UPDATE delivery_drivers SET dispatch_status = 'out_for_delivery' WHERE employee_id = 15
    API->>DB: INSERT audit_logs (module='parcels', action='dispatch')
    API->>DB: COMMIT TRANSACTION
    API-->>Dispatcher: 200 OK (Run Sheet Dispatched)
```

#### Capacity & Compliance Checks:
1. **Total Weight Capacity:** $\sum \text{weight\_kg} \le \text{delivery\_drivers.max\_weight\_capacity\_kg}$.
2. **Total Volume Capacity:** $\sum \frac{\text{length} \times \text{width} \times \text{height}}{1,000,000} \le \text{delivery\_drivers.max\_volume\_capacity\_m3}$.
3. **Vehicle Custody:** If `asset_id` is supplied, server checks `asset_assignments` to verify whether the driver has actively checked out that asset.

---

### Flow C: Doorstep Delivery Execution & Proof of Delivery (POD)

```mermaid
sequenceDiagram
    autonumber
    actor Driver as Courier Driver
    actor Recipient as Package Recipient
    participant App as Driver Mobile PWA
    participant API as Parcels & Storage API
    participant Disk as Tenant File Storage
    participant DB as MariaDB

    Driver->>Recipient: Delivers package, collects COD cash ($100.00)
    Recipient->>App: Signs on screen
    Driver->>App: Takes doorstep delivery photo
    
    App->>API: POST /api/storage/files (file: photo.jpg, category: doorstep_photo)
    API->>Disk: Write to STORAGE_DIR/<org_id>/<uuid>.jpg
    API->>DB: INSERT INTO storage_files (organization_id, stored_name, mime_type, size_bytes)
    API-->>App: { id: "FILE-1", url: "/api/storage/files/1?exp=..." }

    App->>API: POST /api/parcels/:id/mark-delivered
    Note over App,API: Payload: { signature_file_id: "FILE-2", photo_file_id: "FILE-1", lat: 30.0444, lng: 31.2357, amount_collected: 100.00 }
    
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT * FROM parcels WHERE id = :id FOR UPDATE
    API->>DB: Verify parcel.lifecycle_status == 'out_for_delivery'
    API->>DB: UPDATE parcels SET lifecycle_status = 'delivered', delivered_at = NOW(), recipient_signature_url = :sig_url, doorstep_photo_url = :photo_url, delivered_latitude = :lat, delivered_longitude = :lng
    API->>DB: INSERT parcel_events (parcel_id, status='delivered', notes='Collected 100.00 cash')
    API->>DB: INSERT audit_logs (module='parcels', action='status_change', resource_type='parcel')
    API->>DB: COMMIT TRANSACTION
    API-->>App: 200 OK (Delivery Confirmed)
```

#### Proof of Delivery (POD) Evidence Rules:
- **Storage Isolation:** POD images and signature files are saved via `StorageService` under tenant-partitioned disk folders (`<STORAGE_DIR>/<organization_id>/<uuid>`).
- **Signed URL Access:** Public direct access to raw storage is blocked. Images are accessed using time-bounded 15-minute cryptographically signed URLs (`GET /api/storage/files/:id?exp=...&sig=...`).
- **GPS Telematics Ping:** The mobile client captures GPS coordinates (`delivered_latitude`, `delivered_longitude`) at the precise moment of completion to verify doorstep presence.

---

### Flow D: Delivery Failure, Reattempt & Return to Sender (RTS)

```mermaid
sequenceDiagram
    autonumber
    actor Driver as Courier Driver
    actor Dispatcher as Hub Dispatcher
    participant API as Parcels API
    participant DB as MariaDB

    Note over Driver,API: Scenario 1: Delivery Attempt Fails
    Driver->>API: POST /api/parcels/:id/fail-attempt (reason_code: 'customer_unavailable', notes: 'Phone switched off')
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE parcels SET lifecycle_status = 'failed_attempt', delivery_attempt_count = delivery_attempt_count + 1, failed_reason_code = 'customer_unavailable'
    API->>DB: INSERT parcel_events (parcel_id, status='failed_attempt', notes='Phone switched off')
    API->>DB: COMMIT TRANSACTION
    API-->>Driver: Attempt Logged. Return package to hub.

    Note over Dispatcher,API: Scenario 2: Return to Sender (RTS) Decision
    Dispatcher->>API: POST /api/parcels/:id/return (reason: 'max_attempts_exceeded_customer_unreachable')
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE parcels SET lifecycle_status = 'returned_to_sender'
    API->>DB: INSERT parcel_events (parcel_id, status='returned_to_sender')
    API->>DB: UPDATE clients SET pending_cod_balance = pending_cod_balance - cod_amount WHERE id = parcel.client_id
    opt Return Surcharge Agreed
        API->>DB: INSERT merchant_ledger_entries (client_id, type='debit', ref='delivery_fee_debit', amount=3.50, description='RTS Return handling fee')
        API->>DB: UPDATE clients SET current_balance = current_balance - 3.50
    end
    API->>DB: COMMIT TRANSACTION
    API-->>Dispatcher: Parcel Marked RTS
```

#### Standard Failure Reason Codes:
1. `customer_unavailable`: Customer not present at delivery address.
2. `phone_unreachable`: Recipient phone busy, powered off, or disconnected.
3. `incorrect_address`: Street, building, or landmark details invalid.
4. `refused_delivery`: Recipient rejected the package.
5. `refused_cod_payment`: Recipient refused to pay requested COD amount.
6. `customer_rescheduled`: Recipient requested delivery on an alternate date.
7. `damaged_package`: Package arrived damaged; returned for inspection.

---

## 5. Security & Isolation Controls

1. **Composite Tenant Checks:** In every SQL query, repositories must append `AND parcels.organization_id = :org_id`.
2. **Pessimistic Locking on Updates:** Changing parcel status, assigning drivers, or submitting delivery POD must acquire an exclusive row lock (`SELECT ... FOR UPDATE`) to prevent simultaneous dispatcher collisions or duplicate status transitions.
3. **Audit Immutability:** All updates, fee adjustments, and status changes write entity snapshots (`old_values`, `new_values`) into `audit_logs` inside the modifying transaction.
