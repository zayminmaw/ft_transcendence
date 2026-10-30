import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { OrganizationsModule } from '../organizations';
import { RbacModule } from '../rbac';
import { EventsGateway } from './events.gateway';

@Module({
	imports: [AuthModule, OrganizationsModule, RbacModule],
	providers: [EventsGateway],
	exports: [EventsGateway],
})
export class NotificationsModule {}
