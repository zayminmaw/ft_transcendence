export { AuthAuditRepository } from './auth-audit.repository';
export { AuthModule } from './auth.module';
export { JwtAuthGuard } from './jwt-auth.guard';
// For the 42 login, so it ends exactly like password login:
//   const session = await sessions.start(user.id, requestMeta(request));
//   setRefreshCookie(response, session);
export { setRefreshCookie } from './refresh-cookie';
export { type RequestMeta, requestMeta } from './request-meta';
export { AuditLog } from './entities/audit-log.entity';
export { SessionsService } from './sessions.service';
