export { auditRoutes } from './routes';
// For other modules: an "Inspect changes" button next to any record, or the pieces it is built from.
export { ActionBadge } from './components/ActionBadge';
export { InspectChangesButton } from './components/InspectChangesButton';
export { ItemAuditModal } from './components/ItemAuditModal';
export { AuditLogTable } from './components/AuditLogTable';
export { useAuditAccess } from './hooks/useAuditLogs';
export { auditSearch } from './api';
export type { AuditAction, AuditEntry, AuditFilters, AuditPage } from './api';
export { describeEntry, lookup, resourceName, resourceText } from './utils/describe';
