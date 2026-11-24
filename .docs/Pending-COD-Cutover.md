# Pending COD at delivery: deployment cutover

Migration `1793750400000-PendingCodAtDelivery` changes the basis of `clients.pending_cod_balance`. Dispatch and failed attempts no longer contribute. Only delivered parcels awaiting a COD handover contribute.

The migration recomputes each merchant's derived pending balance from its own company's parcels, excluding parcels already present in `driver_cod_collections`. It uses recorded collection for delivered parcels. A legacy delivered parcel with NULL `collected_amount` uses COD due, matching the existing handover calculation; the migration leaves that unknown collection field NULL. Recorded collections that differ from COD due stop the migration for reconciliation, as the cash policy requires exact collection. Totals beyond the decimal column's range also stop it.

Merchant available balances, ledger lines, settlements, collection facts and audit history are preserved. No credit or cash handover is manufactured. Inactive merchants are included because their outstanding cash still exists.

## Deploy

1. Back up the database and stop **all** API instances and other writers that can dispatch, deliver, return parcels or reconcile COD. Keep them stopped throughout the data and code cutover. A rolling deployment with old and new writers mixed is unsupported.
2. With the normal database environment configured, build the new backend and run its standard migration command (`npm run migration:run` from `backend/`). The DML-only cutover runs in its own transaction even though the repository's default migration mode is `none`. A failure rolls back the balance update and migration marker; reconcile any reported data issue before retrying.
3. Verify pending COD equals delivered, unhanded cash per merchant and company. Parcels still out for delivery or awaiting reattempt must not contribute. Start only the new backend version, then re-enable other writers.

A parcel dispatched before cutover has its old in-transit hold removed. Delivery after cutover adds its collection once. Returning that parcel adds or removes nothing. Existing delivered cash remains pending until handover, which clears it once.

## Roll back

Stop all writers again. Revert any later migrations in reverse order, then run `npx typeorm migration:revert -d dist/database/data-source.js --transaction each` from `backend/` while the new build is still available. The transaction flag is required: TypeORM's revert path ignores the per-migration transaction setting, and this migration refuses to change balances without an active transaction. Its `down` recomputes the old basis from current records: out-for-delivery, failed-attempt and delivered parcels without collections contribute COD due. It does not restore a stale balance captured before intervening handovers. Start the old backend only after that data rollback succeeds.
