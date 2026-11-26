import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { sessionStore } from '@app/store/session';
import { endSession, refreshSession } from '@services/session-refresh';
import { useAuth } from './useAuth';

// Identifies what changed; fetch the record over HTTP to read it.
export type NotificationPayload = {
	action: 'CREATE' | 'UPDATE' | 'DELETE';
	module: string;
	resourceId: string;
	resourceType?: string;
	organizationId: string;
	timestamp: string;
};

// A contact's new status. The server sends it only to people who saved that person, for the company of this socket.
export type PresencePayload = {
	organizationId: string;
	userId: string;
	status: 'online' | 'offline' | 'suspended';
	timestamp: string;
};

export type WebSocketHandlers = {
	onNotification?: (payload: NotificationPayload) => void;
	onPresence?: (payload: PresencePayload) => void;
	// Events sent while disconnected are lost, so refetch here.
	onReconnect?: () => void;
};

export function useWebSocket({ onNotification, onPresence, onReconnect }: WebSocketHandlers = {}) {
	const { accessToken, activeOrganizationId } = useAuth();
	const handlers = useRef({ onNotification, onPresence, onReconnect });
	const catchUpOnConnect = useRef(false);

	useEffect(() => {
		handlers.current = { onNotification, onPresence, onReconnect };
	});

	useEffect(() => {
		if (!accessToken || !activeOrganizationId) return;
		// The server verifies both values; a new socket per session/company leaves the old company's rooms.
		// The page's own origin: NGINX (production) and the Vite proxy (development) forward it to the backend.
		const socket = io({
			auth: { token: accessToken, organizationId: activeOrganizationId },
		});
		let active = true;
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		let attempt = 0;
		// 1 s, 2 s, 4 s… up to 30 s, randomized so clients don't all return at once after an outage.
		const later = (retry: () => void) => {
			const delay = Math.min(30_000, 1_000 * 2 ** attempt++) * (0.5 + Math.random() / 2);
			retryTimer = setTimeout(() => active && retry(), delay);
		};

		// A new access token changes accessToken, which opens a new socket.
		const renew = () => {
			void refreshSession().then((result) => {
				if (result === 'unavailable' && active) later(renew);
				else if (
					result === 'ended' &&
					sessionStore.getSnapshot().accessToken === accessToken
				)
					endSession('expired');
			});
		};

		socket.on('connect', () => {
			if (!active) return;
			attempt = 0;
			if (catchUpOnConnect.current) handlers.current.onReconnect?.();
			catchUpOnConnect.current = true;
		});

		socket.on('notification', (payload: NotificationPayload) => {
			// Drop events queued for a previous company or session.
			if (active && payload.organizationId === activeOrganizationId)
				handlers.current.onNotification?.(payload);
		});

		socket.on('presence', (payload: PresencePayload) => {
			// Same guard as notifications: drop events queued for a previous company or session.
			if (active && payload.organizationId === activeOrganizationId)
				handlers.current.onPresence?.(payload);
		});

		// The server closes the socket when the access token expires. A new token reconnects it.
		socket.on('disconnect', (reason) => {
			if (active && reason === 'io server disconnect') renew();
		});

		// A reconnect after a long network drop still carries the expired token. A refused handshake doesn't retry by
		// itself: Unavailable (a server fault) is retried, Unauthorized would stay refused, network errors retry alone.
		socket.on('connect_error', (error) => {
			if (!active) return;
			// The page can load before the first connection succeeds. Catch up on events missed while it was refused.
			catchUpOnConnect.current = true;
			if (error.message === 'TokenExpired') renew();
			else if (error.message === 'Unavailable') later(() => socket.connect());
		});

		return () => {
			active = false;
			clearTimeout(retryTimer);
			socket.disconnect();
		};
	}, [accessToken, activeOrganizationId]);
}
