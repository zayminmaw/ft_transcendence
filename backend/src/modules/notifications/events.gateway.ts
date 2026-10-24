import { ForbiddenException, Logger } from '@nestjs/common';
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

// Only identifies what changed. Clients refetch it over HTTP, where field-level permissions still apply.
export interface NotificationEvent {
	action: NotificationAction;
	module: string;
	resourceId: string;
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
	// Access-token expiry in seconds since the epoch.
	expiresAt: number;
}

// A handshake refused for bad input, as opposed to an unexpected failure such as a database outage.
class HandshakeRejected extends Error {}

const tokenErrors = new Set(['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError']);
const positiveId = /^[1-9]\d*$/;
const organizationRoom = (organizationId: string) => `org:${organizationId}`;
const userRoom = (organizationId: string, userId: string) => `org:${organizationId}:user:${userId}`;

@WebSocketGateway()
export class EventsGateway implements OnGatewayInit, OnGatewayConnection {
	@WebSocketServer()
	server!: Server;

	private readonly logger = new Logger(EventsGateway.name);

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
				(error: unknown) => {
					if (!this.isRejection(error)) {
						this.logger.warn(`WebSocket handshake failed: ${error instanceof Error ? error.message : 'unknown error'}`);
					}
					next(new Error('Unauthorized'));
				},
			);
		});
	}

	handleConnection(socket: Socket): void {
		const { user, tenant, expiresAt } = socket.data as ClientData;
		// One socket serves one verified company; switching companies requires a new connection.
		void socket.join([
			organizationRoom(tenant.organizationId),
			userRoom(tenant.organizationId, user.id),
		]);
		// The client reconnects with a refreshed token, and that handshake re-checks the membership.
		const expiry = setTimeout(() => socket.disconnect(true), Math.max(0, expiresAt * 1000 - Date.now()));
		socket.once('disconnect', () => clearTimeout(expiry));
	}

	async sendNotification(target: NotificationTarget, event: NotificationEvent): Promise<void> {
		const { organizationId, permission, userId } = target;
		if (!positiveId.test(organizationId) || (userId !== undefined && !positiveId.test(userId)) || !positiveId.test(event.resourceId)) {
			throw new Error('Notifications require positive integer identifiers.');
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
			throw new HandshakeRejected('A bearer token and organization ID are required.');
		}
		const { userId, expiresAt } = await this.verifyAccessToken(token);
		const tenant = await this.members.requireActiveMembership(userId, organizationId);
		socket.data = { user: { id: userId }, tenant, expiresAt } satisfies ClientData;
	}

	// Mirrors JwtAuthGuard's claim checks; keep both in sync until auth exposes a shared verifier.
	private async verifyAccessToken(token: string): Promise<{ userId: string; expiresAt: number }> {
		const payload = await this.jwt.verifyAsync<{ sub?: unknown; exp?: unknown }>(token);
		if (typeof payload.sub !== 'string' || !positiveId.test(payload.sub) || typeof payload.exp !== 'number') {
			throw new HandshakeRejected('Invalid token claims');
		}
		return { userId: payload.sub, expiresAt: payload.exp };
	}

	private isRejection(error: unknown): boolean {
		return error instanceof HandshakeRejected
			|| error instanceof ForbiddenException
			|| (error instanceof Error && tokenErrors.has(error.name));
	}
}
