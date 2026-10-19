import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

// Applies the same allowed origin as the HTTP API instead of a per-gateway wildcard.
export class CorsIoAdapter extends IoAdapter {
	constructor(
		app: INestApplicationContext,
		private readonly origin: string,
	) {
		super(app);
	}

	createIOServer(port: number, options?: ServerOptions) {
		return super.createIOServer(port, { ...options, cors: { origin: this.origin } });
	}
}
