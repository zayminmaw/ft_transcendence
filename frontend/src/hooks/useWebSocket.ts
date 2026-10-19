import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';

export type NotificationPayload = {
	action: 'CREATE' | 'UPDATE' | 'DELETE';
	module: string;
	data: unknown;
	organizationId: string;
	timestamp: string;
};

const socketUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export function useWebSocket(
	onNotification: (payload: NotificationPayload) => void = (payload) =>
		console.info('[notification]', payload),
) {
	const { accessToken, activeOrganizationId } = useAuth();
	const handler = useRef(onNotification);

	useEffect(() => {
		handler.current = onNotification;
	});

	useEffect(() => {
		if (!accessToken || !activeOrganizationId) return;
		// The server verifies both values; a new socket per session/company leaves the old company's rooms.
		const socket = io(socketUrl, {
			auth: { token: accessToken, organizationId: activeOrganizationId },
		});
		let active = true;

		socket.on('notification', (payload: NotificationPayload) => {
			// Drop events queued for a previous company or session.
			if (active && payload.organizationId === activeOrganizationId) handler.current(payload);
		});

		return () => {
			active = false;
			socket.disconnect();
		};
	}, [accessToken, activeOrganizationId]);
}
