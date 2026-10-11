-- Schema reference snapshot of backend/src/database/migrations/initial-schema.sql.
-- Apply schema changes through TypeORM migrations; this reference is not a reset script.
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,          -- 'super_admin', 'org_admin', 'dispatcher', etc.
    name VARCHAR(128) NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,          -- 'organizations.read', 'parcels.dispatch', etc.
    module VARCHAR(64) NOT NULL,               -- 'organizations', 'parcels', 'billing', etc.
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
    role_id INT UNSIGNED NOT NULL,
    permission_id INT UNSIGNED NOT NULL,
    scope ENUM('all', 'assigned_only') NOT NULL DEFAULT 'all',
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
    INDEX idx_role_permissions_role_id (role_id),
    INDEX idx_role_permissions_permission_id (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_roles (
    user_id BIGINT UNSIGNED NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    INDEX idx_user_roles_user_id (user_id),
    INDEX idx_user_roles_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. ORGANIZATIONS & TENANT MEMBERSHIPS
-- ============================================================================

CREATE TABLE organizations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    slug VARCHAR(64) NOT NULL UNIQUE,
    tax_id VARCHAR(128) NULL,
    contact_email VARCHAR(191) NOT NULL,
    contact_phone VARCHAR(32) NULL,
    address TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_org_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE organization_members (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_org_user (organization_id, user_id),
    CONSTRAINT fk_om_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_om_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_om_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT,
    INDEX idx_organization_members_organization_id (organization_id),
    INDEX idx_organization_members_user_id (user_id),
    INDEX idx_organization_members_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. CLIENTS / MERCHANTS
-- ============================================================================

CREATE TABLE clients (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    client_code VARCHAR(32) NOT NULL,
    business_name VARCHAR(191) NOT NULL,
    trade_license_no VARCHAR(128) NULL,
    contact_person_name VARCHAR(128) NOT NULL,
    contact_title VARCHAR(64) NULL,
    mobile_1 VARCHAR(32) NOT NULL,
    mobile_2 VARCHAR(32) NULL,
    email VARCHAR(191) NOT NULL,
    billing_address TEXT NOT NULL,
    default_pickup_address TEXT NOT NULL,
    pickup_latitude DECIMAL(10, 8) NULL,
    pickup_longitude DECIMAL(11, 8) NULL,
    current_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    pending_cod_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    rate_profile_tier VARCHAR(32) NOT NULL DEFAULT 'standard',
    operational_notes TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_org_client_code (organization_id, client_code),
    CONSTRAINT fk_clients_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    INDEX idx_clients_business_name (business_name),
    INDEX idx_clients_mobile (mobile_1),
    INDEX idx_clients_organization_id (organization_id),
    INDEX idx_clients_code (client_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. PERSONNEL & HR (BASE EMPLOYEE, STAFF & DRIVERS)
-- ============================================================================

CREATE TABLE employees (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NULL UNIQUE,
    employee_code VARCHAR(32) NOT NULL,
    first_name VARCHAR(64) NOT NULL,
    last_name VARCHAR(64) NOT NULL,
    department ENUM('executive', 'hr', 'finance', 'operations', 'field_logistics') NOT NULL,
    personnel_type ENUM('internal_staff', 'driver') NOT NULL,
    employment_classification ENUM('full_time', 'part_time', 'contractor', 'owner') NOT NULL,
    compensation_type ENUM('fixed_salary', 'hourly', 'commission_only', 'hybrid') NOT NULL,
    base_salary DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    bank_account_iban VARCHAR(64) NULL,
    bank_name VARCHAR(128) NULL,
    national_id VARCHAR(64) NOT NULL,
    date_of_birth DATE NOT NULL,
    personal_mobile VARCHAR(32) NOT NULL,
    personal_email VARCHAR(191) NOT NULL,
    residential_address TEXT NOT NULL,
    emergency_contact_name VARCHAR(128) NOT NULL,
    emergency_contact_phone VARCHAR(32) NOT NULL,
    employment_status ENUM('active', 'on_leave', 'probation', 'terminated') NOT NULL DEFAULT 'active',
    hire_date DATE NOT NULL,
    termination_date DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_org_employee_code (organization_id, employee_code),
    CONSTRAINT fk_emp_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_emp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_emp_dept (department),
    INDEX idx_emp_type (personnel_type),
    INDEX idx_employees_organization_id (organization_id),
    INDEX idx_employees_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE company_staff (
    employee_id BIGINT UNSIGNED PRIMARY KEY,
    job_title VARCHAR(128) NOT NULL,
    assigned_office_hub VARCHAR(128) NOT NULL,
    shift_schedule VARCHAR(64) NULL,
    reporting_manager_id BIGINT UNSIGNED NULL,
    corporate_email VARCHAR(191) NULL,
    internal_phone_ext VARCHAR(16) NULL,
    CONSTRAINT fk_staff_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
    CONSTRAINT fk_staff_manager FOREIGN KEY (reporting_manager_id) REFERENCES employees (id) ON DELETE SET NULL,
    INDEX idx_company_staff_employee_id (employee_id),
    INDEX idx_company_staff_reporting_manager_id (reporting_manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_drivers (
    employee_id BIGINT UNSIGNED PRIMARY KEY,
    driver_category ENUM('motorcycle', 'van', 'heavy_truck', 'bicycle') NOT NULL,
    fleet_arrangement ENUM('company_vehicle', 'owner_operator') NOT NULL,
    commission_per_drop DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    license_number VARCHAR(64) NOT NULL UNIQUE,
    license_class VARCHAR(32) NOT NULL,
    license_expiry_date DATE NOT NULL,
    background_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
    background_check_date DATE NULL,
    transit_insurance_policy VARCHAR(64) NULL,
    transit_insurance_expiry DATE NULL,
    assigned_zone VARCHAR(64) NULL,
    max_weight_capacity_kg DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    max_volume_capacity_m3 DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    dispatch_status ENUM('off_duty', 'available', 'on_pickup', 'out_for_delivery', 'suspended') NOT NULL DEFAULT 'off_duty',
    current_latitude DECIMAL(10, 8) NULL,
    current_longitude DECIMAL(11, 8) NULL,
    last_location_ping TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_driver_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
    INDEX idx_driver_status (dispatch_status),
    INDEX idx_driver_zone (assigned_zone),
    INDEX idx_delivery_drivers_employee_id (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. FLEET & ASSETS
-- ============================================================================

CREATE TABLE assets (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    asset_tag VARCHAR(64) NOT NULL,
    asset_name VARCHAR(128) NOT NULL,
    category ENUM('motorcycle', 'van', 'thermal_bag', 'barcode_scanner', 'mobile_pos', 'other') NOT NULL,
    acquisition_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    current_book_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    license_plate VARCHAR(32) NULL,
    vin VARCHAR(64) NULL,
    insurance_policy_number VARCHAR(64) NULL,
    road_tax_expiry DATE NULL,
    current_condition ENUM('new', 'good', 'needs_maintenance', 'decommissioned') NOT NULL DEFAULT 'good',
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_org_asset_tag (organization_id, asset_tag),
    CONSTRAINT fk_assets_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    INDEX idx_asset_category (category),
    INDEX idx_asset_condition (current_condition),
    INDEX idx_assets_organization_id (organization_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE asset_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT UNSIGNED NOT NULL,
    driver_id BIGINT UNSIGNED NOT NULL,
    checked_out_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_in_at TIMESTAMP NULL DEFAULT NULL,
    checkout_notes TEXT NULL,
    checkin_notes TEXT NULL,
    CONSTRAINT fk_aa_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE,
    CONSTRAINT fk_aa_driver FOREIGN KEY (driver_id) REFERENCES delivery_drivers (employee_id) ON DELETE CASCADE,
    INDEX idx_aa_active (asset_id, checked_in_at),
    INDEX idx_asset_assignments_asset_id (asset_id),
    INDEX idx_asset_assignments_driver_id (driver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE asset_maintenance_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    asset_id BIGINT UNSIGNED NOT NULL,
    service_date DATE NOT NULL,
    service_type VARCHAR(128) NOT NULL,
    service_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    vendor_service_center VARCHAR(128) NULL,
    next_service_due DATE NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_aml_asset FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE,
    INDEX idx_asset_maintenance_logs_asset_id (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. PARCELS & OPERATIONAL EVENTS
-- ============================================================================

CREATE TABLE parcels (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    tracking_number VARCHAR(64) NOT NULL UNIQUE,
    client_id BIGINT UNSIGNED NOT NULL,
    assigned_driver_id BIGINT UNSIGNED NULL,
    assigned_asset_id BIGINT UNSIGNED NULL,

    recipient_name VARCHAR(128) NOT NULL,
    recipient_phone VARCHAR(32) NOT NULL,
    recipient_secondary_phone VARCHAR(32) NULL,
    delivery_address TEXT NOT NULL,
    delivery_city_zone VARCHAR(64) NOT NULL,
    delivery_landmark VARCHAR(128) NULL,
    delivery_latitude DECIMAL(10, 8) NULL,
    delivery_longitude DECIMAL(11, 8) NULL,

    weight_kg DECIMAL(8, 2) NOT NULL DEFAULT 0.50,
    length_cm DECIMAL(8, 2) NULL,
    width_cm DECIMAL(8, 2) NULL,
    height_cm DECIMAL(8, 2) NULL,
    is_fragile BOOLEAN NOT NULL DEFAULT FALSE,
    package_type VARCHAR(64) NOT NULL DEFAULT 'standard_box',

    delivery_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cod_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    declared_value DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_insured BOOLEAN NOT NULL DEFAULT FALSE,
    insurance_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    lifecycle_status ENUM(
        'draft',
        'pickup_scheduled',
        'picked_up',
        'in_hub_sorted',
        'out_for_delivery',
        'delivered',
        'failed_attempt',
        'returned_to_sender'
    ) NOT NULL DEFAULT 'draft',
    delivery_attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    failed_reason_code VARCHAR(64) NULL,

    recipient_signature_url VARCHAR(255) NULL,
    doorstep_photo_url VARCHAR(255) NULL,
    delivered_at TIMESTAMP NULL DEFAULT NULL,
    delivered_latitude DECIMAL(10, 8) NULL,
    delivered_longitude DECIMAL(11, 8) NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_parcel_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_parcel_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
    CONSTRAINT fk_parcel_driver FOREIGN KEY (assigned_driver_id) REFERENCES delivery_drivers (employee_id) ON DELETE SET NULL,
    CONSTRAINT fk_parcel_asset FOREIGN KEY (assigned_asset_id) REFERENCES assets (id) ON DELETE SET NULL,

    INDEX idx_parcels_status (lifecycle_status),
    INDEX idx_parcels_client (client_id),
    INDEX idx_parcels_driver (assigned_driver_id),
    INDEX idx_parcels_zone (delivery_city_zone),
    INDEX idx_parcels_organization_id (organization_id),
    INDEX idx_parcels_client_id (client_id),
    INDEX idx_parcels_assigned_driver_id (assigned_driver_id),
    INDEX idx_parcels_assigned_asset_id (assigned_asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE parcel_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    parcel_id BIGINT UNSIGNED NOT NULL,
    actor_user_id BIGINT UNSIGNED NULL,
    status ENUM(
        'draft',
        'pickup_scheduled',
        'picked_up',
        'in_hub_sorted',
        'out_for_delivery',
        'delivered',
        'failed_attempt',
        'returned_to_sender'
    ) NOT NULL,
    hub_location VARCHAR(128) NULL,
    notes TEXT NULL,
    event_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pe_parcel FOREIGN KEY (parcel_id) REFERENCES parcels (id) ON DELETE CASCADE,
    CONSTRAINT fk_pe_user FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_pe_parcel_ts (parcel_id, event_timestamp),
    INDEX idx_parcel_events_parcel_id (parcel_id),
    INDEX idx_parcel_events_actor_user_id (actor_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. COD DROP, SETTLEMENTS & CLIENT BALANCES
-- ============================================================================

CREATE TABLE driver_cod_settlements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    settlement_reference VARCHAR(64) NOT NULL UNIQUE,
    driver_id BIGINT UNSIGNED NOT NULL,
    reconciled_by_user_id BIGINT UNSIGNED NOT NULL,
    total_cod_expected DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_cash_dropped DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discrepancy_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    settlement_status ENUM('pending', 'verified', 'discrepancy_flagged') NOT NULL DEFAULT 'pending',
    reconciliation_notes TEXT NULL,
    settled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dcs_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_dcs_driver FOREIGN KEY (driver_id) REFERENCES delivery_drivers (employee_id) ON DELETE RESTRICT,
    CONSTRAINT fk_dcs_user FOREIGN KEY (reconciled_by_user_id) REFERENCES users (id) ON DELETE RESTRICT,
    INDEX idx_driver_cod_settlements_organization_id (organization_id),
    INDEX idx_driver_cod_settlements_driver_id (driver_id),
    INDEX idx_driver_cod_settlements_reconciled_by_user_id (reconciled_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE driver_cod_collections (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    settlement_id BIGINT UNSIGNED NOT NULL,
    parcel_id BIGINT UNSIGNED NOT NULL UNIQUE,
    amount_collected DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_method ENUM('cash', 'pos_card', 'qr_transfer') NOT NULL DEFAULT 'cash',
    collected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dcc_settlement FOREIGN KEY (settlement_id) REFERENCES driver_cod_settlements (id) ON DELETE CASCADE,
    CONSTRAINT fk_dcc_parcel FOREIGN KEY (parcel_id) REFERENCES parcels (id) ON DELETE RESTRICT,
    INDEX idx_driver_cod_collections_settlement_id (settlement_id),
    INDEX idx_driver_cod_collections_parcel_id (parcel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE merchant_ledger_entries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    client_id BIGINT UNSIGNED NOT NULL,
    reference_type ENUM('cod_credit', 'delivery_fee_debit', 'payout_disbursement', 'manual_adjustment', 'invoice_offset') NOT NULL,
    reference_id BIGINT UNSIGNED NULL,
    entry_type ENUM('credit', 'debit') NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    balance_after DECIMAL(12, 2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_by_user_id BIGINT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mle_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_mle_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
    CONSTRAINT fk_mle_user FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_mle_client_created (client_id, created_at),
    INDEX idx_merchant_ledger_entries_organization_id (organization_id),
    INDEX idx_merchant_ledger_entries_client_id (client_id),
    INDEX idx_merchant_ledger_entries_created_by_user_id (created_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. INVOICING
-- ============================================================================

CREATE TABLE invoices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    invoice_number VARCHAR(64) NOT NULL UNIQUE,
    client_id BIGINT UNSIGNED NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    total_deliveries INT UNSIGNED NOT NULL DEFAULT 0,
    total_delivery_fees DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_cod_collected DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    net_amount_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status ENUM('draft', 'issued', 'paid_via_balance_offset', 'paid_via_bank_transfer', 'overdue') NOT NULL DEFAULT 'draft',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    created_by_user_id BIGINT UNSIGNED NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE RESTRICT,
    CONSTRAINT fk_inv_user FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE RESTRICT,
    INDEX idx_inv_client (client_id),
    INDEX idx_inv_status (status),
    INDEX idx_invoices_organization_id (organization_id),
    INDEX idx_invoices_client_id (client_id),
    INDEX idx_invoices_created_by_user_id (created_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_id BIGINT UNSIGNED NOT NULL,
    parcel_id BIGINT UNSIGNED NOT NULL UNIQUE,
    delivery_fee DECIMAL(12, 2) NOT NULL,
    cod_amount DECIMAL(12, 2) NOT NULL,
    surcharges DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    net_item_amount DECIMAL(12, 2) NOT NULL,
    CONSTRAINT fk_ii_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
    CONSTRAINT fk_ii_parcel FOREIGN KEY (parcel_id) REFERENCES parcels (id) ON DELETE RESTRICT,
    INDEX idx_invoice_items_invoice_id (invoice_id),
    INDEX idx_invoice_items_parcel_id (parcel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. SYSTEM AUDIT LOGGING
-- ============================================================================

CREATE TABLE audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NULL,
    user_id BIGINT UNSIGNED NULL,
    module VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    record_id VARCHAR(64) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_al_org FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE SET NULL,
    CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    INDEX idx_al_module (module),
    INDEX idx_al_created (created_at),
    INDEX idx_audit_logs_organization_id (organization_id),
    INDEX idx_audit_logs_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
