import { Module } from '@nestjs/common';
import { AuditModule } from '../audit';
import { AuthModule } from '../auth';
// Imported from its own file, not the contacts index: that index loads ContactsModule, which imports this module, and the
// cycle would leave this import undefined (test/module-graph.test.cjs catches it).
import { ContactsStoreModule } from '../contacts/contacts-store.module';
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
