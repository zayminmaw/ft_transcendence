import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { DetailItem, ExpiryDate, ModulePage, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan } from '@modules/auth';
import { formatDate } from '@utils/format';
import { AssetNotFound } from '../components/AssetNotFound';
import { CheckInDialog } from '../components/CheckInDialog';
import { CheckOutDialog } from '../components/CheckOutDialog';
import { ConditionBadge } from '../components/ConditionBadge';
import { MaintenanceDialog } from '../components/MaintenanceDialog';
import { VEHICLE_CATEGORIES } from '../constants';
import { useAssetDetails } from '../hooks/useAssets';

// /assets/:assetId: one asset, who has it, and its check-out and service history. Checking out and in needs
// assets.assign, logging a service assets.log_maintenance, editing assets.create.
export function AssetDetailsPage() {
	const { assetId = '' } = useParams();
	const { t, i18n } = useTranslation('assets');
	const companyPath = useCompanyPath();
	const can = useCan();
	const { asset, isAssetPending, assetError } = useAssetDetails(assetId);
	const [checkOutOpen, setCheckOutOpen] = useState(false);
	const [checkInOpen, setCheckInOpen] = useState(false);
	const [maintenanceOpen, setMaintenanceOpen] = useState(false);

	if (isAssetPending)
		return <span className="loading loading-spinner" aria-label={t('page.loading')} />;
	if (!asset) return <AssetNotFound error={assetError} />;

	const none = t('details.none');
	const time = (value: string) =>
		formatDate(value, i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
	const day = (value: string) => formatDate(value, i18n.language);
	const decommissioned = asset.currentCondition === 'decommissioned';
	const holder = asset.holder;
	const vehicle = VEHICLE_CATEGORIES.includes(asset.category);
	// Driver pages need drivers.view; without it the name shows as plain text.
	const driverName = (driverId: string, name: string) =>
		can('drivers.view') ? (
			<Link to={companyPath(`drivers/${driverId}`)} className="link link-hover">
				{name}
			</Link>
		) : (
			name
		);

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath('assets')} className="link link-hover w-fit text-sm">
				{t('form.backToList')}
			</Link>
			<ModulePage
				title={asset.assetName}
				description={`${asset.assetTag} · ${t(`category.${asset.category}`)}`}
				actions={
					<div className="flex flex-col gap-2 sm:flex-row">
						{can('assets.log_maintenance') && !decommissioned && (
							<button
								type="button"
								className="btn border-0 bg-base-200"
								onClick={() => setMaintenanceOpen(true)}
							>
								{t('maintenance.open')}
							</button>
						)}
						{can('assets.create') && (
							<Link
								to={companyPath(`assets/${asset.id}/edit`)}
								className="btn btn-primary md:px-8"
							>
								{t('details.edit')}
							</Link>
						)}
					</div>
				}
			/>

			{decommissioned && (
				<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
					<p className="font-medium">{t('details.decommissionedTitle')}</p>
					<p className="mt-1 text-[var(--color-slate)]">
						{t('details.decommissionedNote')}
					</p>
				</div>
			)}

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex flex-col gap-6">
					<section
						aria-labelledby="asset-profile-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<h2 id="asset-profile-title" className="text-lg font-semibold">
							{t('details.asset')}
						</h2>
						<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
							<DetailItem label={t('fields.assetTag')} ltr>
								{asset.assetTag}
							</DetailItem>
							<DetailItem label={t('fields.category')}>
								{t(`category.${asset.category}`)}
							</DetailItem>
							<DetailItem label={t('fields.currentCondition')}>
								<ConditionBadge condition={asset.currentCondition} />
							</DetailItem>
							<DetailItem label={t('details.nextService')}>
								{asset.nextServiceDue ? (
									<ExpiryDate date={asset.nextServiceDue} />
								) : (
									none
								)}
							</DetailItem>
							{vehicle && (
								<>
									<DetailItem label={t('fields.licensePlate')} ltr>
										{asset.licensePlate ?? none}
									</DetailItem>
									<DetailItem label={t('fields.vin')} ltr>
										{asset.vin ?? none}
									</DetailItem>
									<DetailItem label={t('fields.insurancePolicyNumber')} ltr>
										{asset.insurancePolicyNumber ?? none}
									</DetailItem>
									<DetailItem label={t('fields.roadTaxExpiry')}>
										{asset.roadTaxExpiry ? (
											<ExpiryDate date={asset.roadTaxExpiry} />
										) : (
											none
										)}
									</DetailItem>
								</>
							)}
						</dl>
						{asset.notes && (
							<dl className="mt-5">
								<DetailItem label={t('fields.notes')}>{asset.notes}</DetailItem>
							</dl>
						)}
					</section>

					<section
						aria-labelledby="asset-assignments-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<h2 id="asset-assignments-title" className="text-lg font-semibold">
							{t('details.assignments')}
						</h2>
						{asset.assignments.length === 0 ? (
							<p className="mt-4 text-sm text-[var(--color-slate)]">
								{t('details.noAssignments')}
							</p>
						) : (
							<ol className="mt-4 flex flex-col divide-y divide-base-300">
								{asset.assignments.map((assignment) => (
									<li key={assignment.id} className="py-4 text-sm">
										<p className="font-medium">
											{driverName(assignment.driverId, assignment.driverName)}
										</p>
										<p className="mt-1 text-[var(--color-slate)]">
											{assignment.checkedInAt
												? t('details.outAndIn', {
														out: time(assignment.checkedOutAt),
														in: time(assignment.checkedInAt),
													})
												: t('details.outSince', {
														out: time(assignment.checkedOutAt),
													})}
										</p>
										{assignment.checkoutNotes && (
											<p className="mt-1">
												{t('details.checkoutNotes', {
													notes: assignment.checkoutNotes,
												})}
											</p>
										)}
										{assignment.checkinNotes && (
											<p className="mt-1">
												{t('details.checkinNotes', {
													notes: assignment.checkinNotes,
												})}
											</p>
										)}
									</li>
								))}
							</ol>
						)}
					</section>

					<section
						aria-labelledby="asset-maintenance-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<h2 id="asset-maintenance-title" className="text-lg font-semibold">
							{t('details.maintenance')}
						</h2>
						{asset.maintenanceLogs.length === 0 ? (
							<p className="mt-4 text-sm text-[var(--color-slate)]">
								{t('details.noMaintenance')}
							</p>
						) : (
							<ol className="mt-4 flex flex-col divide-y divide-base-300">
								{asset.maintenanceLogs.map((log) => (
									<li key={log.id} className="py-4 text-sm">
										<div className="flex flex-wrap justify-between gap-2">
											<p className="font-medium">{log.serviceType}</p>
											<p dir="ltr" className="font-medium">
												{log.serviceCost}
											</p>
										</div>
										<p className="mt-1 text-[var(--color-slate)]">
											{[day(log.serviceDate), log.vendorServiceCenter]
												.filter(Boolean)
												.join(' · ')}
										</p>
										{log.nextServiceDue && (
											<p className="mt-1">
												{t('details.nextDue', {
													date: day(log.nextServiceDue),
												})}
											</p>
										)}
										{log.notes && <p className="mt-1">{log.notes}</p>}
									</li>
								))}
							</ol>
						)}
					</section>
				</div>

				<aside className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">{t('details.holder')}</h2>
						<dl className="mt-6 flex flex-col gap-5">
							<DetailItem
								label={t('details.with')}
								note={
									holder &&
									t('details.since', { time: time(holder.checkedOutAt) })
								}
							>
								{holder
									? driverName(holder.driverId, holder.driverName)
									: t('table.inDepot')}
							</DetailItem>
						</dl>
						{can('assets.assign') && !decommissioned && (
							<button
								type="button"
								className="btn btn-sm mt-6 border-0 bg-base-100"
								onClick={() =>
									holder ? setCheckInOpen(true) : setCheckOutOpen(true)
								}
							>
								{holder ? t('checkIn.open') : t('checkOut.open')}
							</button>
						)}
					</section>

					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">{t('details.value')}</h2>
						<dl className="mt-6 flex flex-col gap-5">
							<DetailItem
								label={t('fields.currentBookValue')}
								ltr
								valueClassName="text-lg font-semibold"
							>
								{asset.currentBookValue}
							</DetailItem>
							<DetailItem label={t('fields.acquisitionCost')} ltr>
								{asset.acquisitionCost}
							</DetailItem>
						</dl>
					</section>
					<TipCard
						title={t('details.tipTitle')}
						description={t('details.tipDescription')}
					/>
				</aside>
			</div>

			{checkOutOpen && (
				<CheckOutDialog asset={asset} onClose={() => setCheckOutOpen(false)} />
			)}
			{checkInOpen && holder && (
				<CheckInDialog
					asset={asset}
					holder={holder}
					onClose={() => setCheckInOpen(false)}
				/>
			)}
			{maintenanceOpen && (
				<MaintenanceDialog asset={asset} onClose={() => setMaintenanceOpen(false)} />
			)}
		</div>
	);
}
