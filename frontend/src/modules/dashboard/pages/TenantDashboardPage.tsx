import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnalyticsCard, ModulePage, type AnalyticsItem } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { shownName, useCurrentWorkspace, useMe, useRoleName } from '@modules/auth';
import { formatNumber } from '@utils/format';
import {
	ActivityInsightsWidget,
	ContactsWidget,
	TeamAccessWidget,
} from '../components/AdminWidgets';
import { FinanceWidget } from '../components/FinanceWidget';
import { ParcelsWidget } from '../components/ParcelsWidget';
import { DriversWidget, FleetWidget, MerchantsWidget } from '../components/WorkforceWidgets';
import { useDashboardData, useDashboardPermissions } from '../hooks/useDashboardData';

type QuickAction = {
	key: string;
	to: string;
	label: string;
	primary?: boolean;
};

type WidgetEntry = {
	key: string;
	wide?: boolean;
	node: (spanClass: string) => ReactNode;
};

export function TenantDashboardPage() {
	const { t, i18n } = useTranslation('dashboard');
	const companyPath = useCompanyPath();
	const workspace = useCurrentWorkspace();
	const me = useMe().data;
	const roleName = useRoleName();
	const perms = useDashboardPermissions();
	const data = useDashboardData(perms);

	const number = (value: number | null | undefined) => formatNumber(value, i18n.language);
	const assignedOnlyParcels = perms.canViewParcels && !perms.canViewAllParcels;
	const canReadClientFinancials = perms.canViewClients && perms.canViewClientFinancials;
	const hasFinanceWidget = perms.canReconcileCod || canReadClientFinancials;

	// Build permission-gated quick actions matching neighboring pages (PeopleAccessPage, DispatchPage):
	// secondary actions (bg-base-200) come first; the primary action (btn-primary) sits at the end.
	const quickActions: QuickAction[] = [];
	if (perms.canViewParcels && perms.canCreateParcels) {
		quickActions.push({
			key: 'new-parcel',
			to: companyPath('parcels/new'),
			label: t('quickActions.newParcel'),
			primary: !perms.canDispatchParcels,
		});
	}
	if (perms.canViewParcels && perms.canDispatchParcels) {
		quickActions.push({
			key: 'assign-driver',
			to: companyPath('parcels/assign'),
			label: t('quickActions.assignDriver'),
			primary: true,
		});
	}
	if (perms.canReconcileCod) {
		quickActions.push({
			key: 'cash-handover',
			to: companyPath('cash-handover'),
			label: t('quickActions.cashHandover'),
			primary: true,
		});
	}
	if (perms.canManageUsers) {
		quickActions.push({
			key: 'invites',
			to: companyPath('rbac/invites'),
			label: t('quickActions.inviteLink'),
		});
		quickActions.push({
			key: 'new-member',
			to: companyPath('rbac/new'),
			label: t('quickActions.newMember'),
			primary: true,
		});
	}
	if (perms.canViewDrivers && perms.canManageDrivers) {
		quickActions.push({
			key: 'new-driver',
			to: companyPath('drivers/new'),
			label: t('quickActions.newDriver'),
			primary: true,
		});
	}
	if (perms.canViewAssets && perms.canCreateAssets) {
		quickActions.push({
			key: 'new-asset',
			to: companyPath('assets/new'),
			label: t('quickActions.newAsset'),
			primary: true,
		});
	}
	if (perms.canViewClients && perms.canCreateClients && quickActions.length < 3) {
		quickActions.push({
			key: 'new-client',
			to: companyPath('clients/new'),
			label: t('quickActions.newClient'),
			primary: quickActions.length === 0,
		});
	}
	if (assignedOnlyParcels && quickActions.length === 0) {
		quickActions.push({
			key: 'my-run',
			to: companyPath('parcels'),
			label: t('quickActions.openMyRun'),
			primary: true,
		});
	}
	// Keep at most 2 quick actions in the header (matching DispatchPage & PeopleAccessPage): one secondary + one primary.
	const primaryAction = quickActions.find((action) => action.primary) ?? quickActions[0];
	const secondaryAction = quickActions.find((action) => action !== primaryAction);
	const visibleActions = [secondaryAction, primaryAction].filter(
		(action): action is QuickAction => Boolean(action),
	);

	// Build up to 4 role-tailored headline KPIs from the exact datasets this role is authorized to read.
	const kpis: AnalyticsItem[] = [];
	const parcelStatuses = data.parcels.data?.counts.statuses;
	const parcelExceptions = parcelStatuses
		? parcelStatuses.failed_attempt + parcelStatuses.returned_to_sender
		: undefined;
	const activeMembers = data.members.data?.filter((m) => m.isActive).length;
	const pendingInvites = data.invites.data?.filter((i) => i.status === 'pending').length;
	const onlineContacts = data.contacts.data?.filter((c) => c.status === 'online').length;

	if (perms.canViewParcels && !assignedOnlyParcels) {
		kpis.push({
			label: t('kpi.readyToDispatch'),
			value: number(parcelStatuses?.in_hub_sorted),
			description: t('kpi.readyToDispatchHint'),
		});
		kpis.push({
			label: t('kpi.outForDelivery'),
			value: number(parcelStatuses?.out_for_delivery),
			description: t('kpi.driversOutHint', {
				count: data.parcels.data?.counts.driversOut ?? 0,
				formatted: number(data.parcels.data?.counts.driversOut ?? 0),
			}),
		});
		kpis.push({
			label: t('kpi.exceptions'),
			value: number(parcelExceptions),
			description: t('kpi.exceptionsHint'),
		});
	} else if (assignedOnlyParcels) {
		kpis.push({
			label: t('kpi.myOutForDelivery'),
			value: number(parcelStatuses?.out_for_delivery),
			description: t('kpi.myOutForDeliveryHint'),
		});
		kpis.push({
			label: t('kpi.myDelivered'),
			value: number(parcelStatuses?.delivered),
			description: t('kpi.myDeliveredHint'),
		});
		kpis.push({
			label: t('kpi.myExceptions'),
			value: number(parcelExceptions),
			description: t('kpi.exceptionsHint'),
		});
	}

	if (perms.canReconcileCod && kpis.length < 4) {
		kpis.push({
			label: t('kpi.codHandoverDrivers'),
			value: number(data.cashDrivers.data?.length),
			description: t('kpi.codHandoverHint'),
		});
	}

	if (perms.canManageUsers) {
		if (kpis.length < 4) {
			kpis.push({
				label: t('kpi.activeMembers'),
				value:
					activeMembers != null && data.members.data
						? t('kpi.ratio', {
								active: number(activeMembers),
								total: number(data.members.data.length),
							})
						: '—',
				description: t('kpi.activeMembersHint'),
			});
		}
		if (kpis.length < 4) {
			kpis.push({
				label: t('kpi.pendingInvites'),
				value: number(pendingInvites),
				description: t('kpi.pendingInvitesHint'),
			});
		}
	}

	if (perms.canViewAudit && kpis.length < 4) {
		kpis.push({
			label: t('kpi.workspaceVisits'),
			value: number(data.insights.data?.visits),
			description: t('kpi.last30Days'),
		});
	}

	if (perms.canViewAssets && !perms.canViewParcels) {
		if (kpis.length < 4) {
			kpis.push({
				label: t('kpi.assetsInService'),
				value: number(data.assets.data?.counts.inService),
				description: t('kpi.assetsCheckedOutHint', {
					count: data.assets.data?.counts.checkedOut ?? 0,
					formatted: number(data.assets.data?.counts.checkedOut ?? 0),
				}),
			});
		}
		if (kpis.length < 4) {
			kpis.push({
				label: t('kpi.needsMaintenance'),
				value: number(data.assets.data?.counts.needsMaintenance),
				description: t('kpi.roadTaxDueHint', {
					count: data.assets.data?.counts.roadTaxDue ?? 0,
					formatted: number(data.assets.data?.counts.roadTaxDue ?? 0),
				}),
			});
		}
	}

	if (perms.canViewDrivers) {
		if (!perms.canViewParcels && !perms.canViewAssets && kpis.length < 4) {
			kpis.push({
				label: t('kpi.totalDrivers'),
				value: number(data.drivers.data?.counts.total),
				description: t('kpi.totalDriversHint'),
			});
		}
		if (kpis.length < 4) {
			kpis.push({
				label: t('kpi.driversAvailable'),
				value: number(data.drivers.data?.counts.available),
				description: t('kpi.driversOnRunHint', {
					count: data.drivers.data?.counts.onRun ?? 0,
					formatted: number(data.drivers.data?.counts.onRun ?? 0),
				}),
			});
		}
		if (perms.canViewDriverCompliance && kpis.length < 4) {
			kpis.push({
				label: t('kpi.licensesExpiring'),
				value: number(data.drivers.data?.counts.licensesExpiring),
				description: t('kpi.licensesExpiringHint'),
			});
		}
	}

	if (perms.canViewClients && kpis.length < 4) {
		kpis.push({
			label: t('kpi.activeMerchants'),
			value: number(data.clients.data?.counts.active),
			description: t('kpi.activeMerchantsHint'),
		});
	}

	if (perms.canManageContacts && kpis.length < 4) {
		kpis.push({
			label: t('kpi.onlineContacts'),
			value: number(onlineContacts),
			description: t('kpi.savedContactsHint', {
				count: data.contacts.data?.length ?? 0,
				formatted: number(data.contacts.data?.length ?? 0),
			}),
		});
	}

	// Assemble visible widgets in priority order for the user's role.
	const widgets: WidgetEntry[] = [];

	if (perms.canViewParcels) {
		widgets.push({
			key: 'parcels',
			wide: true,
			node: (spanClass) => (
				<ParcelsWidget
					key="parcels"
					data={data.parcels.data}
					isPending={data.parcels.isPending}
					isError={data.parcels.isError}
					onRetry={() => void data.parcels.refetch()}
					assignedOnly={assignedOnlyParcels}
					canDispatch={perms.canDispatchParcels}
					canMarkDelivered={perms.canMarkDelivered}
					className={spanClass}
				/>
			),
		});
	}

	if (hasFinanceWidget) {
		widgets.push({
			key: 'finance',
			wide: true,
			node: (spanClass) => (
				<FinanceWidget
					key="finance"
					cashDrivers={data.cashDrivers.data}
					isCashPending={data.cashDrivers.isPending}
					isCashError={data.cashDrivers.isError}
					onRetryCash={() => void data.cashDrivers.refetch()}
					clients={data.clients.data}
					isClientsPending={data.clients.isPending}
					isClientsError={data.clients.isError}
					onRetryClients={() => void data.clients.refetch()}
					canReconcileCod={perms.canReconcileCod}
					canViewFinancials={canReadClientFinancials}
					className={spanClass}
				/>
			),
		});
	}

	if (perms.canManageUsers) {
		widgets.push({
			key: 'team',
			wide: true,
			node: (spanClass) => (
				<TeamAccessWidget
					key="team"
					members={data.members.data}
					invites={data.invites.data}
					isPending={data.members.isPending || data.invites.isPending}
					isError={data.members.isError || data.invites.isError}
					onRetry={() => {
						void data.members.refetch();
						void data.invites.refetch();
					}}
					canManageRoles={perms.canManageRoles}
					className={spanClass}
				/>
			),
		});
	}

	if (perms.canViewAudit) {
		widgets.push({
			key: 'activity',
			wide: !perms.canViewParcels && !hasFinanceWidget,
			node: (spanClass) => (
				<ActivityInsightsWidget
					key="activity"
					insights={data.insights.data}
					isPending={data.insights.isPending}
					isError={data.insights.isError}
					onRetry={() => void data.insights.refetch()}
					className={spanClass}
				/>
			),
		});
	}

	if (perms.canViewDrivers) {
		widgets.push({
			key: 'drivers',
			wide: !perms.canViewParcels && !perms.canViewAssets,
			node: (spanClass) => (
				<DriversWidget
					key="drivers"
					drivers={data.drivers.data}
					dispatchDrivers={
						perms.canDispatchParcels ? data.dispatchDrivers.data : undefined
					}
					isPending={
						data.drivers.isPending ||
						(perms.canDispatchParcels && data.dispatchDrivers.isPending)
					}
					isError={
						data.drivers.isError ||
						(perms.canDispatchParcels && data.dispatchDrivers.isError)
					}
					onRetry={() => {
						void data.drivers.refetch();
						if (perms.canDispatchParcels) void data.dispatchDrivers.refetch();
					}}
					canViewCompliance={perms.canViewDriverCompliance}
					canManageDrivers={perms.canManageDrivers}
					className={spanClass}
				/>
			),
		});
	}

	if (perms.canViewAssets) {
		widgets.push({
			key: 'fleet',
			wide: !perms.canViewParcels,
			node: (spanClass) => (
				<FleetWidget
					key="fleet"
					assets={data.assets.data}
					isPending={data.assets.isPending}
					isError={data.assets.isError}
					onRetry={() => void data.assets.refetch()}
					className={spanClass}
				/>
			),
		});
	}

	if (perms.canViewClients && !perms.canViewClientFinancials) {
		widgets.push({
			key: 'merchants',
			node: (spanClass) => (
				<MerchantsWidget
					key="merchants"
					clients={data.clients.data}
					isPending={data.clients.isPending}
					isError={data.clients.isError}
					onRetry={() => void data.clients.refetch()}
					className={spanClass}
				/>
			),
		});
	}

	if (perms.canManageContacts) {
		widgets.push({
			key: 'contacts',
			node: (spanClass) => (
				<ContactsWidget
					key="contacts"
					contacts={data.contacts.data}
					isPending={data.contacts.isPending}
					isError={data.contacts.isError}
					onRetry={() => void data.contacts.refetch()}
					className={spanClass}
				/>
			),
		});
	}

	// Compute balanced 12-column spans so every role's widget set lands on clean rows with zero awkward orphan holes.
	const spanFor = (widget: WidgetEntry, index: number): string => {
		const count = widgets.length;
		if (count === 1) return 'lg:col-span-12';
		if (count === 2) {
			if (widget.wide && !widgets[1 - index]?.wide) return 'lg:col-span-8';
			if (!widget.wide && widgets[1 - index]?.wide) return 'lg:col-span-4';
			return 'lg:col-span-6';
		}
		if (count === 3) {
			if (index === 0) return 'lg:col-span-12';
			return 'lg:col-span-6';
		}
		// 4+ widgets: lead wide widget takes 8 cols paired with a 4-col companion, remaining widgets pair cleanly 6+6.
		if (index === 0 && widget.wide) return 'lg:col-span-8';
		if (index === 1 && widgets[0]?.wide) return 'lg:col-span-4';
		const remaining = count - 2;
		if (remaining % 2 === 1 && index === count - 1) return 'lg:col-span-12';
		return 'lg:col-span-6';
	};

	const greetingName = me ? shownName(me.user) : '';
	const currentRole = workspace ? roleName(workspace.role) : '';

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={
					workspace
						? t('header.title', { company: workspace.name })
						: t('header.fallbackTitle')
				}
				description={
					greetingName && currentRole
						? t('header.subtitle', { name: greetingName, role: currentRole })
						: t('header.fallbackSubtitle')
				}
				actions={
					visibleActions.length > 0 ? (
						<div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
							{visibleActions.map((action) => (
								<Link
									key={action.key}
									to={action.to}
									className={
										action === primaryAction
											? 'btn btn-primary md:px-8'
											: 'btn border-0 bg-base-200 md:px-8'
									}
								>
									{action.label}
								</Link>
							))}
						</div>
					) : undefined
				}
			/>

			{kpis.length > 0 && <AnalyticsCard items={kpis} className="tabular-nums" />}

			{widgets.length === 0 ? (
				<section className="rounded-box border border-base-300 bg-base-200 px-6 py-12 text-center">
					<h2 className="text-base font-semibold text-base-content">
						{t('emptyWorkspace.title')}
					</h2>
					<p className="mx-auto mt-1 max-w-prose text-sm text-[var(--color-slate)]">
						{t('emptyWorkspace.description')}
					</p>
				</section>
			) : (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					{widgets.map((widget, index) => widget.node(spanFor(widget, index)))}
				</div>
			)}
		</div>
	);
}
