import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

export type NotificationAction = 'CREATE' | 'UPDATE' | 'DELETE';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway {
	@WebSocketServer()
	server!: Server;

	sendNotification(action: NotificationAction, module: string, data: unknown): void {
		this.server.emit('notification', {
			action,
			module,
			data,
			timestamp: new Date().toISOString(),
		});
	}
}
