import type { TFunction } from 'i18next';
import type { ToastOptions } from '@global-components';
import type { NotificationPayload } from './useWebSocket';

export const LIVE_NOTIFICATION_DEDUPE_WINDOW_MS = 3_000;

export const LIVE_NOTIFICATION_MODULES = [
	'auth',
	'members',
	'platform',
	'parcels',
	'clients',
	'contacts',
	'billing',
	'staff',
	'drivers',
	'assets',
	'audit',
	'insights',
] as const;

export type LiveNotificationModule = (typeof LIVE_NOTIFICATION_MODULES)[number];

export type LiveNotificationModuleKey =
	`liveNotifications.modules.${LiveNotificationModule}` | 'liveNotifications.modules.unknown';

export type LiveNotificationActionKey =
	| 'liveNotifications.actions.create'
	| 'liveNotifications.actions.update'
	| 'liveNotifications.actions.delete';

const KNOWN_MODULES: ReadonlySet<string> = new Set(LIVE_NOTIFICATION_MODULES);

const ACTION_KEYS: Record<NotificationPayload['action'], LiveNotificationActionKey> = {
	CREATE: 'liveNotifications.actions.create',
	UPDATE: 'liveNotifications.actions.update',
	DELETE: 'liveNotifications.actions.delete',
};

export function notificationDedupeKey(payload: NotificationPayload): string {
	return `${payload.organizationId}:${payload.module}:${payload.resourceType ?? ''}:${payload.action}:${payload.resourceId}`;
}

export function notificationModuleKey(module: string): LiveNotificationModuleKey {
	return KNOWN_MODULES.has(module)
		? `liveNotifications.modules.${module as LiveNotificationModule}`
		: 'liveNotifications.modules.unknown';
}

export function notificationActionKey(
	action: NotificationPayload['action'],
): LiveNotificationActionKey | null {
	return Object.hasOwn(ACTION_KEYS, action) ? ACTION_KEYS[action] : null;
}

export function formatLiveNotification(
	payload: NotificationPayload,
	t: TFunction,
): ToastOptions | null {
	const actionKey = notificationActionKey(payload.action);
	if (!actionKey) return null;
	const moduleLabel = t(notificationModuleKey(payload.module));
	const description = payload.resourceId
		? t('liveNotifications.record', { id: payload.resourceId })
		: undefined;
	return {
		variant: 'info',
		title: t(actionKey, { module: moduleLabel }),
		description,
	};
}

// Suppresses duplicate toasts for the same record/action within a short burst window.
export function createNotificationDeduplicator(windowMs = LIVE_NOTIFICATION_DEDUPE_WINDOW_MS) {
	const seen = new Map<string, number>();

	return {
		shouldNotify(payload: NotificationPayload, now = Date.now()): boolean {
			// Older servers do not identify the resource table. Equal IDs may then refer to different records.
			if (!payload.resourceType) return true;
			for (const [key, seenAt] of seen) {
				if (now - seenAt >= windowMs || now < seenAt) seen.delete(key);
			}
			const key = notificationDedupeKey(payload);
			if (seen.has(key)) return false;
			seen.set(key, now);
			return true;
		},
		clear() {
			seen.clear();
		},
		size() {
			return seen.size;
		},
	};
}
