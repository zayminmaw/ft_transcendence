import { queryClient } from '@app/store/query-client';
import { tenantQueryKey } from '@utils/query-keys';
import { useWebSocket } from './useWebSocket';

// Every audit load is itself audited as a read, so the trail refreshes only when asked.
const notAuditTrail = ({ queryKey }: { queryKey: readonly unknown[] }) =>
	queryKey[3] !== 'audit-logs';

// Refreshes the open company's screens when someone changes its data. Events name a module, and each module's
// queries sit under tenantQueryKey(<module>).
export function useLiveUpdates() {
	useWebSocket({
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
