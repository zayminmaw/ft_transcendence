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
	organizationId: string;
	timestamp: string;
};

export type WebSocketHandlers = {
	onNotification?: (payload: NotificationPayload) => void;
	// Events sent while disconnected are lost, so refetch here.
	onReconnect?: () => void;
};

// Unset in production: the socket uses the page's own origin, which NGINX forwards to the backend.
const socketUrl = import.meta.env.VITE_WS_URL || undefined;

export function useWebSocket({
	onNotification = (payload) => console.info('[notification]', payload),
	onReconnect,
}: WebSocketHandlers = {}) {
	const { accessToken, activeOrganizationId } = useAuth();
	const handlers = useRef({ onNotification, onReconnect });
	const connectedBefore = useRef(false);

	useEffect(() => {
		handlers.current = { onNotification, onReconnect };
	});

	useEffect(() => {
		if (!accessToken || !activeOrganizationId) return;
		// The server verifies both values; a new socket per session/company leaves the old company's rooms.
		const socket = io(socketUrl, {
			auth: { token: accessToken, organizationId: activeOrganizationId },
		});
		let active = true;

		socket.on('connect', () => {
			if (active && connectedBefore.current) handlers.current.onReconnect?.();
			connectedBefore.current = true;
		});

		socket.on('notification', (payload: NotificationPayload) => {
			// Drop events queued for a previous company or session.
			if (active && payload.organizationId === activeOrganizationId)
				handlers.current.onNotification?.(payload);
		});

		// The server closes the socket when the access token expires. A new token reconnects it.
		socket.on('disconnect', (reason) => {
			if (!active || reason !== 'io server disconnect') return;
			void refreshSession().then((result) => {
				if (result === 'ended' && sessionStore.getSnapshot().accessToken === accessToken)
					endSession('expired');
			});
		});

		return () => {
			active = false;
			socket.disconnect();
		};
	}, [accessToken, activeOrganizationId]);
}
