import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { AuthModule } from '../auth';
import { ContactsStoreModule } from '../contacts';
import { OrganizationsModule } from '../organizations';
import { RbacModule } from '../rbac';
import { AuditNotifications } from './audit-notifications';
import { EventsGateway } from './events.gateway';
import { PresenceService } from './presence.service';

@Module({
	imports: [AuditModule, AuthModule, ContactsStoreModule, OrganizationsModule, RbacModule],
	providers: [EventsGateway, AuditNotifications, PresenceService],
	exports: [EventsGateway, PresenceService],
})
export class NotificationsModule {}
