import { queryClient } from '@app/store/query-client';
import { applyPresence } from '@modules/contacts';
import { tenantQueryKey } from '@utils/query-keys';
import { useWebSocket } from './useWebSocket';

// Every audit load is itself audited as a read, so the trail refreshes only when asked.
const notAuditTrail = ({ queryKey }: { queryKey: readonly unknown[] }) =>
	queryKey[3] !== 'audit-logs';

// Refreshes the open company's screens when someone changes its data. Events name a module, and each module's
// queries sit under tenantQueryKey(<module>). A contact's status arrives on the same socket (one connection per open
// company, so presence counts the person once) and goes straight into the cached contacts list.
export function useLiveUpdates() {
	useWebSocket({
		onPresence: applyPresence,
		onNotification: ({ module }) =>
			void queryClient.invalidateQueries({ queryKey: tenantQueryKey(module) }),
		// Events sent while disconnected are lost: refresh everything.
		onReconnect: () =>
			void queryClient.invalidateQueries({
				queryKey: tenantQueryKey(),
				predicate: notAuditTrail,
			}),
	});
}
