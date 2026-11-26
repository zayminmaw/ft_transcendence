export { auditRoutes } from './routes';
// For other modules: an "Inspect changes" button next to any record, or the pieces it is built from.
export { InspectChangesButton } from './components/InspectChangesButton';
export { ItemAuditModal } from './components/ItemAuditModal';
export { AuditLogTable } from './components/AuditLogTable';
export { AuditDetailDialog } from './components/AuditDetailDialog';
export { useAuditAccess } from './hooks/useAuditLogs';
export { AUDIT_ACTIONS, AUDIT_MODULES, auditSearch } from './api';
export type { AuditAction, AuditEntry, AuditFilters, AuditModule, AuditPage } from './api';
