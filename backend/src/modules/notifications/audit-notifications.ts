import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AUDIT_RESOURCES, type AuditAction, type AuditEvent, AuditService } from '../audit';
import { EventsGateway, type NotificationAction, type NotificationEvent, type NotificationTarget } from './events.gateway';

const ACTIONS: Partial<Record<AuditAction, NotificationAction>> = {
	create: 'CREATE',
	update: 'UPDATE',
	status_change: 'UPDATE',
	assign: 'UPDATE',
	revoke: 'UPDATE',
	transfer: 'UPDATE',
	password_reset: 'UPDATE',
	delete: 'DELETE',
};

const positiveId = /^[1-9]\d*$/;

// A committed company change, as the notification its resource's viewers receive. Sign-ins, reads, refusals and
// resources without a viewPermission notify no one.
export function notificationFor(event: AuditEvent): [NotificationTarget, NotificationEvent] | null {
	const action = ACTIONS[event.action];
	const permission = AUDIT_RESOURCES[event.resourceType]?.viewPermission;
	const { organizationId, recordId } = event;
	if (!action || !permission || event.outcome !== 'success' || !organizationId || !recordId || !positiveId.test(recordId)) {
		return null;
	}
	return [{ organizationId, permission }, { action, module: event.module, resourceId: recordId }];
}

// Every audited company change refreshes the open screens of the people allowed to see it.
@Injectable()
export class AuditNotifications implements OnModuleInit, OnModuleDestroy {
	private unsubscribe = () => {};

	constructor(private readonly audit: AuditService, private readonly gateway: EventsGateway) {}

	onModuleInit() {
		this.unsubscribe = this.audit.subscribe((event) => {
			const notification = notificationFor(event);
			return notification ? this.gateway.sendNotification(...notification) : undefined;
		});
	}

	// The publisher outlives this app (e.g. between tests), so leave no listener behind.
	onModuleDestroy() {
		this.unsubscribe();
	}
}
