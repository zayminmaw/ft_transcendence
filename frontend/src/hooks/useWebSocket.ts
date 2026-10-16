import { useEffect } from 'react';
import { io } from 'socket.io-client';

export type NotificationPayload = {
	action: 'CREATE' | 'UPDATE' | 'DELETE';
	module: string;
	data: unknown;
	timestamp: string;
};

const socketUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export function useWebSocket() {
	useEffect(() => {
		const socket = io(socketUrl);

		socket.on('notification', (payload: NotificationPayload) => {
			console.info('[notification]', payload);
		});

		return () => {
			socket.disconnect();
		};
	}, []);
}
