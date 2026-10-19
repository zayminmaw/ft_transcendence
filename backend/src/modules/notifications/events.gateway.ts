import { JwtService } from '@nestjs/jwt';
import {
	type OnGatewayConnection,
	type OnGatewayInit,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { TenantContext } from '../../common/types/authenticated-request';
import { OrganizationMembersService } from '../organizations';
import { PermissionPolicyService } from '../rbac';

export type NotificationAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface NotificationEvent {
	action: NotificationAction;
	module: string;
	data: unknown;
}

export interface NotificationTarget {
	organizationId: string;
	// Recipients' tenant role must hold this permission, exactly as RolesGuard requires for HTTP.
	permission: string;
	// Omit to notify every authorized member connected to the organization.
	userId?: string;
}

interface ClientData {
	user: { id: string };
	tenant: TenantContext;
}

const positiveId = /^[1-9]\d*$/;
const organizationRoom = (organizationId: string) => `org:${organizationId}`;
const userRoom = (organizationId: string, userId: string) => `org:${organizationId}:user:${userId}`;

@WebSocketGateway()
export class EventsGateway implements OnGatewayInit, OnGatewayConnection {
	@WebSocketServer()
	server!: Server;

	constructor(
		private readonly jwt: JwtService,
		private readonly members: OrganizationMembersService,
		private readonly policy: PermissionPolicyService,
	) {}

	afterInit(server: Server): void {
		// Middleware rejects the handshake, so unauthorized clients never connect or join a room.
		server.use((socket, next) => {
			this.authenticate(socket).then(
				() => next(),
				() => next(new Error('Unauthorized')),
			);
		});
	}

	handleConnection(socket: Socket): void {
		const { user, tenant } = socket.data as ClientData;
		// One socket serves one verified company; switching companies requires a new connection.
		void socket.join([
			organizationRoom(tenant.organizationId),
			userRoom(tenant.organizationId, user.id),
		]);
	}

	async sendNotification(target: NotificationTarget, event: NotificationEvent): Promise<void> {
		const { organizationId, permission, userId } = target;
		if (!positiveId.test(organizationId) || (userId !== undefined && !positiveId.test(userId))) {
			throw new Error('Notification targets require positive integer identifiers.');
		}
		const room = userId ? userRoom(organizationId, userId) : organizationRoom(organizationId);
		const payload = { ...event, organizationId, timestamp: new Date().toISOString() };
		const roleAccess = new Map<string, Promise<boolean>>();
		for (const socket of await this.server.in(room).fetchSockets()) {
			const { tenant } = socket.data as ClientData;
			if (tenant.organizationId !== organizationId) continue;
			if (!roleAccess.has(tenant.roleId)) {
				roleAccess.set(tenant.roleId, this.policy.canAccess(tenant.roleId, permission));
			}
			if (await roleAccess.get(tenant.roleId)) socket.emit('notification', payload);
		}
	}

	private async authenticate(socket: Socket): Promise<void> {
		const { token, organizationId } = (socket.handshake.auth ?? {}) as Record<string, unknown>;
		if (typeof token !== 'string' || typeof organizationId !== 'string' || !positiveId.test(organizationId)) {
			throw new Error('A bearer token and organization ID are required.');
		}
		const userId = await this.verifyAccessToken(token);
		const tenant = await this.members.requireActiveMembership(userId, organizationId);
		socket.data = { user: { id: userId }, tenant } satisfies ClientData;
	}

	// Mirrors JwtAuthGuard's claim checks; keep both in sync until auth exposes a shared verifier.
	private async verifyAccessToken(token: string): Promise<string> {
		const payload = await this.jwt.verifyAsync<{ sub?: unknown; exp?: unknown }>(token);
		if (typeof payload.sub !== 'string' || !positiveId.test(payload.sub) || typeof payload.exp !== 'number') {
			throw new Error('Invalid token claims');
		}
		return payload.sub;
	}
}
