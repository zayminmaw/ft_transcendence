import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@services/api-client';
import { tenantsQueryKey } from '@utils/query-keys';
import type {
	AssignAdministratorValues,
	AssignedAdministrator,
	CreatedTenant,
	CreateTenantValues,
	RevokeAdministratorValues,
	RevokedAdministrator,
	Tenant,
	UpdateTenantValues,
} from '../api';

// Creating, editing, suspending and reactivating tenants, and assigning and revoking their administrators. Each
// change refreshes every tenant answer, so the list and the details never show stale data.
export function useTenantMutations() {
	const queryClient = useQueryClient();
	const refreshTenants = () => queryClient.invalidateQueries({ queryKey: tenantsQueryKey() });

	const create = useMutation({
		mutationFn: (values: CreateTenantValues) =>
			apiRequest<CreatedTenant>('platform/tenants', {
				method: 'POST',
				body: JSON.stringify(values),
			}),
		// The variables hold the initial password: don't keep them once the form is gone.
		gcTime: 0,
		onSuccess: refreshTenants,
	});
	const update = useMutation({
		mutationFn: ({ tenantId, values }: { tenantId: string; values: UpdateTenantValues }) =>
			apiRequest<Tenant>(`platform/tenants/${encodeURIComponent(tenantId)}`, {
				method: 'PATCH',
				body: JSON.stringify(values),
			}),
		onSuccess: refreshTenants,
	});
	const setActive = useMutation({
		mutationFn: ({
			tenantId,
			active,
			reason,
		}: {
			tenantId: string;
			active: boolean;
			reason: string;
		}) =>
			apiRequest<Tenant>(
				`platform/tenants/${encodeURIComponent(tenantId)}/${active ? 'reactivate' : 'suspend'}`,
				{ method: 'POST', body: JSON.stringify({ reason }) },
			),
		// Also after a conflict: another admin may have changed the status first.
		onSettled: refreshTenants,
	});
	const assign = useMutation({
		mutationFn: ({
			tenantId,
			values,
		}: {
			tenantId: string;
			values: AssignAdministratorValues;
		}) =>
			apiRequest<AssignedAdministrator>(
				`platform/tenants/${encodeURIComponent(tenantId)}/administrators`,
				{ method: 'POST', body: JSON.stringify(values) },
			),
		// The variables can hold an initial password: don't keep them once the dialog is gone.
		gcTime: 0,
		onSuccess: refreshTenants,
	});
	const revoke = useMutation({
		mutationFn: ({
			tenantId,
			userId,
			values,
		}: {
			tenantId: string;
			userId: string;
			values: RevokeAdministratorValues;
		}) =>
			apiRequest<RevokedAdministrator>(
				`platform/tenants/${encodeURIComponent(tenantId)}/administrators/${encodeURIComponent(userId)}/revoke`,
				{ method: 'POST', body: JSON.stringify(values) },
			),
		// Also after a conflict: the administrators may have changed, and with them whether this one is the last.
		onSettled: refreshTenants,
	});

	return {
		createTenant: create.mutate,
		isCreating: create.isPending,
		updateTenant: update.mutate,
		isUpdating: update.isPending,
		updateError: update.error,
		setTenantActive: setActive.mutate,
		isSettingActive: setActive.isPending,
		setActiveError: setActive.error,
		resetSetActive: setActive.reset,
		assignAdministrator: assign.mutate,
		isAssigning: assign.isPending,
		revokeAdministrator: revoke.mutate,
		isRevoking: revoke.isPending,
		revokeError: revoke.error,
	};
}
