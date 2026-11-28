import { useQuery } from '@tanstack/react-query';
import { useCan } from '@modules/auth';
import { retryServerErrors } from '@services/api-client';
import { tenantQueryKey } from '@utils/query-keys';
import {
	fetchDashboardAssets,
	fetchDashboardCashDrivers,
	fetchDashboardClients,
	fetchDashboardContacts,
	fetchDashboardDispatchDrivers,
	fetchDashboardDrivers,
	fetchDashboardInsights,
	fetchDashboardInvites,
	fetchDashboardMembers,
	fetchDashboardParcels,
} from '../api';

export type DashboardPermissions = {
	canViewParcels: boolean;
	canViewAllParcels: boolean;
	canCreateParcels: boolean;
	canDispatchParcels: boolean;
	canMarkDelivered: boolean;
	canViewClients: boolean;
	canCreateClients: boolean;
	canViewClientFinancials: boolean;
	canViewDrivers: boolean;
	canManageDrivers: boolean;
	canViewDriverCompliance: boolean;
	canViewAssets: boolean;
	canCreateAssets: boolean;
	canReconcileCod: boolean;
	canManageUsers: boolean;
	canManageRoles: boolean;
	canViewAudit: boolean;
	canManageContacts: boolean;
};

// Permission flags for the active workspace. Every query below passes its exact flag to `enabled`, so roles never
// fire unauthorized API requests and only fetch the widgets their permissions grant.
export function useDashboardPermissions(): DashboardPermissions {
	const can = useCan();
	return {
		canViewParcels: can('parcels.view', true),
		canViewAllParcels: can('parcels.view'),
		canCreateParcels: can('parcels.create'),
		canDispatchParcels: can('parcels.dispatch'),
		canMarkDelivered: can('parcels.mark_delivered', true),
		canViewClients: can('clients.view'),
		canCreateClients: can('clients.create'),
		canViewClientFinancials: can('clients.view_financials'),
		canViewDrivers: can('drivers.view'),
		canManageDrivers: can('drivers.manage'),
		canViewDriverCompliance: can('drivers.view_compliance'),
		canViewAssets: can('assets.view'),
		canCreateAssets: can('assets.create'),
		canReconcileCod: can('billing.reconcile_cod'),
		canManageUsers: can('admin.manage_users'),
		canManageRoles: can('admin.manage_roles'),
		canViewAudit: can('admin.audit_logs'),
		canManageContacts: can('contacts.manage_own'),
	};
}

// Each query sits under its module's tenantQueryKey so WebSocket live updates (useLiveUpdates) and presence patches
// (applyPresence on tenantQueryKey('contacts', 'list')) keep dashboard widgets fresh automatically.
export function useDashboardData(perms: DashboardPermissions) {
	const parcels = useQuery({
		queryKey: tenantQueryKey('parcels', 'dashboard'),
		queryFn: fetchDashboardParcels,
		enabled: perms.canViewParcels,
		retry: retryServerErrors,
	});

	const dispatchDrivers = useQuery({
		queryKey: tenantQueryKey('parcels', 'dispatch-drivers'),
		queryFn: fetchDashboardDispatchDrivers,
		enabled: perms.canDispatchParcels,
		retry: retryServerErrors,
	});

	const clients = useQuery({
		queryKey: tenantQueryKey('clients', 'dashboard'),
		queryFn: fetchDashboardClients,
		enabled: perms.canViewClients,
		retry: retryServerErrors,
	});

	const drivers = useQuery({
		queryKey: tenantQueryKey('drivers', 'dashboard'),
		queryFn: fetchDashboardDrivers,
		enabled: perms.canViewDrivers,
		retry: retryServerErrors,
	});

	const assets = useQuery({
		queryKey: tenantQueryKey('assets', 'dashboard'),
		queryFn: fetchDashboardAssets,
		enabled: perms.canViewAssets,
		retry: retryServerErrors,
	});

	const cashDrivers = useQuery({
		queryKey: tenantQueryKey('billing', 'cash-drivers'),
		queryFn: fetchDashboardCashDrivers,
		enabled: perms.canReconcileCod,
		retry: retryServerErrors,
	});

	const members = useQuery({
		queryKey: tenantQueryKey('members', 'list'),
		queryFn: fetchDashboardMembers,
		enabled: perms.canManageUsers,
		retry: retryServerErrors,
	});

	const invites = useQuery({
		queryKey: tenantQueryKey('members', 'invites'),
		queryFn: fetchDashboardInvites,
		enabled: perms.canManageUsers,
		retry: retryServerErrors,
	});

	const insights = useQuery({
		queryKey: tenantQueryKey('insights', 30),
		queryFn: fetchDashboardInsights,
		enabled: perms.canViewAudit,
		retry: retryServerErrors,
	});

	const contacts = useQuery({
		queryKey: tenantQueryKey('contacts', 'list'),
		queryFn: fetchDashboardContacts,
		enabled: perms.canManageContacts,
		retry: retryServerErrors,
	});

	return {
		parcels,
		dispatchDrivers,
		clients,
		drivers,
		assets,
		cashDrivers,
		members,
		invites,
		insights,
		contacts,
	};
}
