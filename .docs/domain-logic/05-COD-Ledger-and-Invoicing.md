# Cash-on-Delivery (COD), Merchant Ledger & Invoicing

**Status:** Authoritative domain financial specification synthesized from `.docs/` requirements, MariaDB schema, ACID transaction rules, and double-entry ledger principles.

Transcend manages the complete financial bridge between doorstep cash collection, hub cashier verification, running merchant balance ledgers, periodic invoicing, and bank payout disbursements.

---

## 1. Domain Entities & Responsibilities

| Table | Scope | Key Attributes |
| --- | --- | --- |
| `driver_cod_settlements` | Driver daily shift cash drop sheet | `settlement_reference`, `driver_id`, `reconciled_by_user_id`, `total_cod_expected`, `total_cash_dropped`, `discrepancy_amount`, `settlement_status`, `settled_at` |
| `driver_cod_collections` | Itemized doorstep collection per parcel | `settlement_id`, `parcel_id`, `amount_collected`, `payment_method` (`cash`, `pos_card`, `qr_transfer`), `collected_at` |
| `clients` | Merchant financial balances | `current_balance` (available funds), `pending_cod_balance` (in-transit funds), `rate_profile_tier` |
| `merchant_ledger_entries` | Running balance journal entries | `client_id`, `reference_type`, `reference_id`, `entry_type` (`credit`, `debit`), `amount`, `balance_after`, `description` |
| `invoices` | Periodic statement of account | `invoice_number`, `client_id`, `billing_period_start`, `billing_period_end`, `total_deliveries`, `total_delivery_fees`, `total_cod_collected`, `net_amount_due`, `status` |
| `invoice_items` | Individual parcel billing lines | `invoice_id`, `parcel_id`, `delivery_fee`, `cod_amount`, `surcharges`, `net_item_amount` |

---

## 2. Fundamental Accounting & Money Invariants

| Rule ID | Rule Definition | Invariant & Mathematical Model |
| --- | --- | --- |
| **FIN-01** | **Decimal Precision Standard** | All monetary columns use `DECIMAL(12,2)`. BigInteger IDs and financial values cross the API/DB boundary as strings. Arithmetic must use exact decimal math (e.g. `bignumber.js` or integer cents) to prevent floating-point drift. |
| **FIN-02** | **Tenant Isolation of Funds** | Every settlement, parcel, collection, invoice, ledger entry, and client balance must belong to the caller's verified `organization_id`. Inter-company money transfers or balance cross-credits are impossible. |
| **FIN-03** | **Atomic Ledger Invariant** | Mutating `clients.current_balance` independently without an accompanying `merchant_ledger_entries` record is strictly forbidden. The balance update and the ledger entry must commit in the exact same database transaction. |
| **FIN-04** | **Balance Perspective & Sign Convention** | The ledger is maintained from the **Merchant's Perspective**:<br>- **Credit (+):** Increases merchant balance (e.g., COD collected from recipients, manual cash deposits). Courier owes merchant.<br>- **Debit (-):** Decreases merchant balance (e.g., delivery service fees, return charges, payout disbursements to merchant bank account).<br>- $\text{Positive Balance } (> 0)$: Courier owes money to merchant.<br>- $\text{Negative Balance } (< 0)$: Merchant owes money to courier. |
| **FIN-05** | **Separation of Physical Delivery & Verified Cash** | Marking a parcel `delivered` records physical drop-off and collected evidence. It **does NOT** immediately credit the merchant's available `current_balance`. Cash must be verified and reconciled by hub finance during the daily handover. |
| **FIN-06** | **Single Collection Uniqueness** | A parcel can have at most one `driver_cod_collections` record. MariaDB enforces a `UNIQUE KEY (parcel_id)` on `driver_cod_collections`. This prevents duplicate cash collection claims across multiple settlement sheets. |
| **FIN-07** | **Discrepancy Formula** | $\text{discrepancy\_amount} = \text{total\_cash\_dropped} - \text{total\_cod\_expected}$.<br>- Negative value represents a **Cash Shortage** (driver turned in less than expected).<br>- Positive value represents a **Cash Overage** (driver turned in more than expected).<br>- Zero represents a perfect reconciliation. |

---

## 3. Financial User & System Flows

### Flow A: Driver Daily COD Handover & Cashier Reconciliation

```mermaid
sequenceDiagram
    autonumber
    actor Driver as Courier / Driver
    actor Cashier as Finance / Hub Cashier
    participant Web as Transcend Web App
    participant API as Billing API
    participant DB as MariaDB

    Note over Driver,Cashier: End of Shift: Driver arrives at Hub Cash Desk
    Driver->>Cashier: Hands over cash pouch + daily run sheet
    Cashier->>Web: Opens /app/billing/reconcile-cod
    Cashier->>Web: Selects Driver (ID: 15)
    Web->>API: GET /api/billing/reconcile-cod/driver/15/unreconciled-parcels
    API->>DB: Query parcels where assigned_driver_id=15 AND lifecycle_status='delivered' AND id NOT IN (SELECT parcel_id FROM driver_cod_collections)
    API-->>Web: Returns 2 parcels: TRK-001 (COD $100), TRK-002 (COD $50). Expected: $150.00

    Cashier->>Web: Counts physical cash: Enters total_cash_dropped = $150.00
    Cashier->>Web: Clicks "Verify & Approve Handover"
    Web->>API: POST /api/billing/reconcile-cod (Driver: 15, Cash: 150.00, Parcels: [TRK-001, TRK-002])

    Note over API,DB: Single ACID Database Transaction
    API->>DB: BEGIN TRANSACTION
    API->>DB: INSERT INTO driver_cod_settlements (organization_id, settlement_reference, driver_id, reconciled_by_user_id, total_cod_expected=150.00, total_cash_dropped=150.00, discrepancy_amount=0.00, settlement_status='verified')
    
    loop For each parcel in settlement
        API->>DB: INSERT INTO driver_cod_collections (settlement_id, parcel_id, amount_collected, payment_method='cash')
        Note over API,DB: Post Merchant Ledger Entries
        API->>DB: SELECT * FROM clients WHERE id = parcel.client_id FOR UPDATE
        API->>DB: INSERT INTO merchant_ledger_entries (client_id, reference_type='cod_credit', reference_id=collection.id, entry_type='credit', amount=parcel.cod_amount, balance_after=B_prev + cod_amount, description='COD credit')
        API->>DB: INSERT INTO merchant_ledger_entries (client_id, reference_type='delivery_fee_debit', reference_id=parcel.id, entry_type='debit', amount=parcel.delivery_fee, balance_after=B_prev + cod_amount - delivery_fee, description='Delivery service fee')
        API->>DB: UPDATE clients SET current_balance = current_balance + cod_amount - delivery_fee, pending_cod_balance = pending_cod_balance - cod_amount WHERE id = parcel.client_id
    end

    API->>DB: INSERT INTO audit_logs (module='billing', action='reconcile_cod', resource_type='settlement')
    API->>DB: COMMIT TRANSACTION
    API-->>Web: 200 OK (Settlement Sheet Verified & Posted)
    Web-->>Cashier: Displays Receipt & Printable Drop Sheet
```

#### Verification Rules:
1. **Pessimistic Lock:** The client row must be locked using `SELECT ... FOR UPDATE` before posting ledger entries to prevent race conditions from concurrent delivery reconciliations or fee charges.
2. **Sequential Balances:** For each ledger entry, `balance_after` must equal the exact previous balance plus (if credit) or minus (if debit) the entry amount:
   $$\text{balance\_after} = \text{balance}_{\text{previous}} \pm \text{amount}$$
3. **Pending COD Release:** Reconciling a parcel moves funds from `pending_cod_balance` to `current_balance`.

---

### Flow B: Discrepancy Flagging & Shortage Resolution

```mermaid
flowchart TD
    StartHandover([Driver Cash Handover]) --> CashCount[Cashier Counts Dropped Cash]
    CashCount --> CalcDisc{Expected == Dropped?}
    
    CalcDisc -- Yes (Match) --> StatusVerified[Status: verified]
    StatusVerified --> PostLedger[Post Full COD Credits to Merchants]
    
    CalcDisc -- No (Mismatch) --> CalcSign{total_cash_dropped < total_cod_expected?}
    CalcSign -- Yes (Shortage) --> FlagShortage[Discrepancy Amount < 0: Cash Shortage]
    CalcSign -- No (Overage) --> FlagOverage[Discrepancy Amount > 0: Cash Overage]
    
    FlagShortage --> FlagSheet[Set settlement_status = discrepancy_flagged]
    FlagOverage --> FlagSheet
    
    FlagSheet --> HoldCredit[Hold Merchant Credit for Disputed Parcels]
    HoldCredit --> Investigate[Finance / Operations Supervisor Investigation]
    
    Investigate --> ResolutionChoice{Resolution?}
    ResolutionChoice -- Driver Pays Shortage --> DriverPouch[Driver Supplies Missing Cash]
    DriverPouch --> ReVerify[Cashier Re-verifies Settlement -> verified]
    ReVerify --> PostLedger
    
    ResolutionChoice -- Customer Short-Paid --> AdjustParcel[Update Parcel Actual Collected Amount]
    AdjustParcel --> PostPartial[Post Adjusted Partial Credit to Merchant]
    
    ResolutionChoice -- Unresolved Shortage --> DeductPayroll[Flag Shortage to HR for Driver Payroll Deduction]
    DeductPayroll --> PostLedger
```

#### Discrepancy Rules:
- If a settlement is marked `discrepancy_flagged`, finance policy determines whether undisputed parcels within the batch are posted or held until sign-off.
- The discrepancy reason and supervisor sign-off are recorded in `driver_cod_settlements.reconciliation_notes` and audited in `audit_logs`.

---

### Flow C: Merchant Invoicing & Periodic Settlement

```mermaid
sequenceDiagram
    autonumber
    actor Finance as Finance Manager
    participant Web as Billing Portal
    participant API as Invoicing API
    participant DB as MariaDB

    Finance->>Web: Opens /app/billing/invoices
    Finance->>Web: Clicks "Generate Billing Statement"
    Finance->>Web: Selects Merchant "TechMart" & Date Range: 2026-10-01 to 2026-10-31
    Web->>API: POST /api/billing/invoices/preview (clientId, startDate, endDate)
    API->>DB: Query delivered parcels for merchant not yet attached to any invoice_items
    API-->>Web: Summary: 50 deliveries | Delivery Fees: $350.00 | COD Collected: $5,000.00 | Net Payable: $4,650.00

    Finance->>Web: Clicks "Issue Invoice"
    Web->>API: POST /api/billing/invoices (clientId, startDate, endDate)

    API->>DB: BEGIN TRANSACTION
    API->>DB: INSERT INTO invoices (organization_id, invoice_number='INV-2026-0042', client_id, billing_period_start, billing_period_end, total_deliveries=50, total_delivery_fees=350.00, total_cod_collected=5000.00, net_amount_due=4650.00, status='issued', issue_date=TODAY, due_date=TODAY+14)
    
    loop For each eligible parcel
        API->>DB: INSERT INTO invoice_items (invoice_id, parcel_id, delivery_fee, cod_amount, surcharges=0.00, net_item_amount)
    end
    API->>DB: INSERT INTO audit_logs (module='billing', action='create_invoice')
    API->>DB: COMMIT TRANSACTION
    API-->>Web: 201 Created (Invoice Issued)
```

#### Invoice Lifecycle States:
1. `draft`: Prepared statement; can be reviewed, edited, or recalculated.
2. `issued`: Finalized legal billing document sent to merchant. Parcel lines locked.
3. `paid_via_balance_offset`: Cleared automatically against the merchant's positive running balance.
4. `paid_via_bank_transfer`: Settled via external wire transfer.
5. `overdue`: Payment deadline (`due_date`) passed without settlement.

---

### Flow D: Merchant Payout Disbursement

When a merchant has an accumulated positive balance (courier owes merchant money collected from recipients), Finance disburses a bank wire payout.

```mermaid
sequenceDiagram
    autonumber
    actor Finance as Finance Officer
    actor Merchant as Merchant Bank Account
    participant Web as Finance UI
    participant API as Billing API
    participant DB as MariaDB

    Finance->>Web: Navigates to /app/clients/:id (Merchant Current Balance: $4,650.00)
    Finance->>Web: Initiates Payout of $4,650.00
    Finance->>Merchant: Submits Wire Transfer via Corporate Banking Portal
    Merchant-->>Finance: Wire Reference: WIRE-20261031-9982

    Finance->>Web: Enters Payout Details (Amount: $4,650.00, Wire Ref: WIRE-..., Bank: National Bank)
    Finance->>Web: Clicks "Confirm & Post Disbursement"
    Web->>API: POST /api/billing/payouts (clientId: 12, amount: 4650.00, wireReference: "WIRE-...")

    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT * FROM clients WHERE id = 12 FOR UPDATE
    API->>API: Verify client.current_balance >= 4650.00
    API->>DB: INSERT INTO merchant_ledger_entries (organization_id, client_id=12, reference_type='payout_disbursement', reference_id=NULL, entry_type='debit', amount=4650.00, balance_after=0.00, description='Payout disbursement Wire Ref: WIRE-20261031-9982')
    API->>DB: UPDATE clients SET current_balance = current_balance - 4650.00 WHERE id = 12
    API->>DB: UPDATE invoices SET status = 'paid_via_bank_transfer' WHERE client_id = 12 AND status = 'issued'
    API->>DB: INSERT INTO audit_logs (module='billing', action='payout_disbursement')
    API->>DB: COMMIT TRANSACTION
    API-->>Web: 200 OK (Disbursement Posted, Balance Now $0.00)
```

---

## 4. Comprehensive Worked Accounting Example

The following table demonstrates the exact running balance ledger transformations for a merchant (`TechMart`) across a full business lifecycle:

| Step | Business Event | Reference Type | Direction | Amount | Balance After | Pending COD | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Onboarding | — | — | — | **$0.00** | **$0.00** | Initial balance |
| 2 | Parcel 1 Dispatched | — | — | — | $0.00 | **$100.00** | $100 COD in transit |
| 3 | Parcel 2 Dispatched | — | — | — | $0.00 | **$150.00** | Additional $50 in transit |
| 4 | Parcel 1 Reconciled | `cod_credit` | **Credit** | $100.00 | **$100.00** | $50.00 | Driver drops cash |
| 5 | Parcel 1 Delivery Fee | `delivery_fee_debit` | **Debit** | $7.00 | **$93.00** | $50.00 | Courier service fee |
| 6 | Parcel 2 Reconciled | `cod_credit` | **Credit** | $50.00 | **$143.00** | $0.00 | Driver drops cash |
| 7 | Parcel 2 Delivery Fee | `delivery_fee_debit` | **Debit** | $7.00 | **$136.00** | $0.00 | Courier service fee |
| 8 | Return Surcharge | `delivery_fee_debit` | **Debit** | $3.50 | **$132.50** | $0.00 | RTS return fee |
| 9 | Payout Disbursement | `payout_disbursement` | **Debit** | $132.50 | **$0.00** | $0.00 | Wire to merchant |

---

## 5. Idempotency & Error Handling Controls

1. **Idempotent Reconciliation:** Repeating a COD reconciliation request with the same `settlement_reference` returns the existing verified settlement sheet without creating duplicate ledger entries or increasing merchant balance twice.
2. **Preventing Double Charging on Invoicing:** When an invoice is issued, it itemizes parcels whose delivery fees and COD amounts have already been posted to the ledger during daily operations. The invoice creation does **not** post duplicate debit/credit entries to `merchant_ledger_entries`.
3. **Negative Balance Protection:** If a merchant's balance goes negative (e.g. high volume of delivery fees or returns with zero COD collections), `clients.current_balance` drops below zero (e.g. `-$45.00`). In this case, Transcend generates an invoice where `net_amount_due` is payable **by** the merchant to the courier.
