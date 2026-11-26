import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { formatNumber } from '@utils/format';
import type {
	DashboardAsset,
	DashboardAssetList,
	DashboardClientList,
	DashboardDispatchDriver,
	DashboardDriver,
	DashboardDriverList,
} from '../api';
import { WidgetFrame } from './WidgetFrame';

function dutyBadgeClass(status: DashboardDriver['dispatchStatus']): string {
	switch (status) {
		case 'available':
			return 'badge-success badge-soft';
		case 'out_for_delivery':
		case 'on_pickup':
			return 'badge-info badge-soft';
		case 'suspended':
			return 'badge-error badge-soft';
		default:
			return 'badge-ghost';
	}
}

function conditionBadgeClass(condition: DashboardAsset['currentCondition']): string {
	switch (condition) {
		case 'new':
			return 'badge-info badge-soft';
		case 'good':
			return 'badge-success badge-soft';
		case 'needs_maintenance':
			return 'badge-warning badge-soft';
		case 'decommissioned':
			return 'badge-ghost';
	}
}

type DriversWidgetProps = {
	drivers: DashboardDriverList | undefined;
	dispatchDrivers: DashboardDispatchDriver[] | undefined;
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
	canViewCompliance: boolean;
	canManageDrivers: boolean;
	className?: string;
};

export function DriversWidget({
	drivers,
	dispatchDrivers,
	isPending,
	isError,
	onRetry,
	canViewCompliance,
	canManageDrivers,
	className = '',
}: DriversWidgetProps) {
	const { t, i18n } = useTranslation('dashboard');
	const { t: tDrivers } = useTranslation('drivers');
	const companyPath = useCompanyPath();
	const number = (value: number) => formatNumber(value, i18n.language);

	const counts = drivers?.counts;
	const expiring = counts?.licensesExpiring ?? 0;
	const showDispatchRuns = (dispatchDrivers?.length ?? 0) > 0;
	const roster = (drivers?.items ?? []).slice(0, 5);

	return (
		<WidgetFrame
			title={t('drivers.title')}
			subtitle={t('drivers.subtitle')}
			actionTo={companyPath('drivers')}
			actionLabel={t('actions.viewAll')}
			actionContext={t('drivers.title')}
			badge={
				canViewCompliance && expiring > 0 ? (
					<span className="badge badge-warning badge-soft badge-sm tabular-nums">
						{t('drivers.expiringBadge', {
							count: expiring,
							formatted: number(expiring),
						})}
					</span>
				) : undefined
			}
			isPending={isPending}
			isError={isError}
			onRetry={onRetry}
			className={className}
		>
			{counts && (
				<dl className="mb-4 grid grid-cols-2 gap-3 rounded-box bg-base-200 p-4 @sm:grid-cols-4">
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{t('drivers.stats.available')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(counts.available)}
						</dd>
					</div>
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{t('drivers.stats.onRun')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(counts.onRun)}
						</dd>
					</div>
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{t('drivers.stats.offDuty')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(counts.offDuty)}
						</dd>
					</div>
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{canViewCompliance
								? t('drivers.stats.expiring')
								: t('drivers.stats.suspended')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(canViewCompliance ? counts.licensesExpiring : counts.suspended)}
						</dd>
					</div>
				</dl>
			)}

			{showDispatchRuns ? (
				<ul className="divide-y divide-base-300">
					{(dispatchDrivers ?? []).slice(0, 5).map((driver) => (
						<li
							key={driver.id}
							className="flex items-center justify-between gap-3 py-3"
						>
							<div className="flex min-w-0 items-center gap-3">
								<Avatar name={driver.name} seed={driver.id} />
								<div className="min-w-0">
									<Link
										to={companyPath(`drivers/${driver.id}`)}
										className="link link-hover block truncate text-sm font-medium"
									>
										<bdi>{driver.name}</bdi>
									</Link>
									<p className="truncate text-xs text-[var(--color-slate)]">
										{driver.vehicle
											? `${driver.vehicle.tag}${driver.vehicle.licensePlate ? ` · ${driver.vehicle.licensePlate}` : ''}`
											: t('drivers.noVehicle')}
									</p>
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								<span className="text-xs tabular-nums text-[var(--color-slate)]">
									{t('drivers.todayParcels', {
										count: driver.todayParcelCount,
										formatted: number(driver.todayParcelCount),
									})}
								</span>
								<span
									className={`badge badge-sm whitespace-nowrap ${dutyBadgeClass(driver.dispatchStatus)}`}
								>
									{tDrivers(`dispatchStatus.${driver.dispatchStatus}`)}
								</span>
							</div>
						</li>
					))}
				</ul>
			) : roster.length === 0 ? (
				<p className="rounded-box bg-base-200 px-4 py-6 text-center text-xs text-[var(--color-slate)]">
					{t('drivers.empty')}
				</p>
			) : (
				<ul className="divide-y divide-base-300">
					{roster.map((driver) => {
						const fullName = `${driver.firstName} ${driver.lastName}`;
						return (
							<li
								key={driver.id}
								className="flex items-center justify-between gap-3 py-3"
							>
								<div className="flex min-w-0 items-center gap-3">
									<Avatar name={fullName} seed={driver.id} />
									<div className="min-w-0">
										<Link
											to={companyPath(`drivers/${driver.id}`)}
											className="link link-hover block truncate text-sm font-medium"
										>
											<bdi>{fullName}</bdi>
										</Link>
										<p className="truncate text-xs text-[var(--color-slate)]">
											<span>{driver.employeeCode}</span>
											{driver.assignedZone ? ` · ${driver.assignedZone}` : ''}
											{canManageDrivers && !driver.account
												? ` · ${t('drivers.unlinkedAccount')}`
												: ''}
										</p>
									</div>
								</div>
								<span
									className={`badge badge-sm shrink-0 whitespace-nowrap ${dutyBadgeClass(driver.dispatchStatus)}`}
								>
									{tDrivers(`dispatchStatus.${driver.dispatchStatus}`)}
								</span>
							</li>
						);
					})}
				</ul>
			)}
		</WidgetFrame>
	);
}

type FleetWidgetProps = {
	assets: DashboardAssetList | undefined;
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
	className?: string;
};

export function FleetWidget({
	assets,
	isPending,
	isError,
	onRetry,
	className = '',
}: FleetWidgetProps) {
	const { t, i18n } = useTranslation('dashboard');
	const { t: tAssets } = useTranslation('assets');
	const companyPath = useCompanyPath();
	const number = (value: number) => formatNumber(value, i18n.language);

	const counts = assets?.counts;
	const roadTaxDue = counts?.roadTaxDue ?? 0;
	const items = (assets?.items ?? []).slice(0, 5);

	return (
		<WidgetFrame
			title={t('fleet.title')}
			subtitle={t('fleet.subtitle')}
			actionTo={companyPath('assets')}
			actionLabel={t('actions.viewAll')}
			actionContext={t('fleet.title')}
			badge={
				roadTaxDue > 0 ? (
					<span className="badge badge-warning badge-soft badge-sm tabular-nums">
						{t('fleet.roadTaxBadge', {
							count: roadTaxDue,
							formatted: number(roadTaxDue),
						})}
					</span>
				) : undefined
			}
			isPending={isPending}
			isError={isError}
			onRetry={onRetry}
			className={className}
		>
			{counts && (
				<dl className="mb-4 grid grid-cols-2 gap-3 rounded-box bg-base-200 p-4 @sm:grid-cols-4">
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{t('fleet.stats.inService')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(counts.inService)}
						</dd>
					</div>
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{t('fleet.stats.checkedOut')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(counts.checkedOut)}
						</dd>
					</div>
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{t('fleet.stats.maintenance')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(counts.needsMaintenance)}
						</dd>
					</div>
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{t('fleet.stats.roadTaxDue')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(counts.roadTaxDue)}
						</dd>
					</div>
				</dl>
			)}

			{items.length === 0 ? (
				<p className="rounded-box bg-base-200 px-4 py-6 text-center text-xs text-[var(--color-slate)]">
					{t('fleet.empty')}
				</p>
			) : (
				<ul className="divide-y divide-base-300">
					{items.map((asset) => (
						<li key={asset.id} className="flex items-center justify-between gap-3 py-3">
							<div className="min-w-0">
								<Link
									to={companyPath(`assets/${asset.id}`)}
									className="link link-hover block truncate text-sm font-medium"
								>
									<span className="font-mono text-xs">{asset.assetTag}</span> ·{' '}
									<bdi>{asset.assetName}</bdi>
								</Link>
								<p className="truncate text-xs text-[var(--color-slate)]">
									{asset.holder
										? t('fleet.heldBy', { name: asset.holder.driverName })
										: t('fleet.inDepot')}
									{asset.licensePlate ? ` · ${asset.licensePlate}` : ''}
								</p>
							</div>
							<span
								className={`badge badge-sm shrink-0 whitespace-nowrap ${conditionBadgeClass(asset.currentCondition)}`}
							>
								{tAssets(`condition.${asset.currentCondition}`)}
							</span>
						</li>
					))}
				</ul>
			)}
		</WidgetFrame>
	);
}

type MerchantsWidgetProps = {
	clients: DashboardClientList | undefined;
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
	className?: string;
};

export function MerchantsWidget({
	clients,
	isPending,
	isError,
	onRetry,
	className = '',
}: MerchantsWidgetProps) {
	const { t, i18n } = useTranslation('dashboard');
	const companyPath = useCompanyPath();
	const number = (value: number) => formatNumber(value, i18n.language);

	const counts = clients?.counts;
	const items = (clients?.items ?? []).slice(0, 5);

	return (
		<WidgetFrame
			title={t('merchants.title')}
			subtitle={t('merchants.subtitle')}
			actionTo={companyPath('clients')}
			actionLabel={t('actions.viewAll')}
			actionContext={t('merchants.title')}
			isPending={isPending}
			isError={isError}
			onRetry={onRetry}
			className={className}
		>
			{counts && (
				<dl className="mb-4 grid grid-cols-3 gap-3 rounded-box bg-base-200 p-4">
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{t('merchants.stats.active')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(counts.active)}
						</dd>
					</div>
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{t('merchants.stats.pinned')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(counts.pinned)}
						</dd>
					</div>
					<div>
						<dt className="text-xs text-[var(--color-slate)]">
							{t('merchants.stats.archived')}
						</dt>
						<dd className="mt-0.5 text-xl font-medium tabular-nums text-base-content">
							{number(counts.archived)}
						</dd>
					</div>
				</dl>
			)}

			{items.length === 0 ? (
				<p className="rounded-box bg-base-200 px-4 py-6 text-center text-xs text-[var(--color-slate)]">
					{t('merchants.empty')}
				</p>
			) : (
				<ul className="divide-y divide-base-300">
					{items.map((client) => (
						<li
							key={client.id}
							className="flex items-center justify-between gap-3 py-3"
						>
							<div className="min-w-0">
								<Link
									to={companyPath(`clients/${client.id}`)}
									className="link link-hover block truncate text-sm font-medium"
								>
									<bdi>{client.businessName}</bdi>
								</Link>
								<p className="truncate text-xs text-[var(--color-slate)]">
									<bdi>{client.contactPersonName}</bdi>
								</p>
							</div>
							<span className="shrink-0 text-xs text-[var(--color-slate)]">
								{client.clientCode}
							</span>
						</li>
					))}
				</ul>
			)}
		</WidgetFrame>
	);
}
