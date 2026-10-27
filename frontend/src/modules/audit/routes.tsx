import type { RouteObject } from 'react-router-dom';
import { AuditLogPage } from './pages/AuditLogPage';

export const auditRoutes: RouteObject[] = [{ path: 'audit', element: <AuditLogPage /> }];
