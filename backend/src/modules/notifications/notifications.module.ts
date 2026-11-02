import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { AuthModule } from '../auth';
import { OrganizationsModule } from '../organizations';
import { RbacModule } from '../rbac';
import { AuditNotifications } from './audit-notifications';
import { EventsGateway } from './events.gateway';

@Module({
	imports: [AuditModule, AuthModule, OrganizationsModule, RbacModule],
	providers: [EventsGateway, AuditNotifications],
	exports: [EventsGateway],
})
export class NotificationsModule {}
