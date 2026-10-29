import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { DetailItem, ExpiryDate, ModulePage, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan } from '@modules/auth';
import { formatDate } from '@utils/format';
import { DriverNotFound } from '../components/DriverNotFound';
import { DutyStatusBadge } from '../components/DutyStatusBadge';
import { DutyStatusDialog } from '../components/DutyStatusDialog';
import { LinkAccountDialog } from '../components/LinkAccountDialog';
import { useDriverDetails } from '../hooks/useDrivers';

// /drivers/:driverId: one courier's profile, vehicle and duty status. Personal data needs drivers.manage,
// compliance drivers.view_compliance, earnings drivers.view_earnings and payroll staff.view_payroll.
export function DriverDetailsPage() {
	const { driverId = '' } = useParams();
	const { t, i18n } = useTranslation('drivers');
	const companyPath = useCompanyPath();
	const can = useCan();
	const { driver, isDriverPending, driverError } = useDriverDetails(driverId);
	const [dutyOpen, setDutyOpen] = useState(false);
	const [accountOpen, setAccountOpen] = useState(false);

	if (isDriverPending)
		return <span className="loading loading-spinner" aria-label={t('page.loading')} />;
	if (!driver) return <DriverNotFound error={driverError} />;

	const none = t('details.none');
	const manage = can('drivers.manage');
	const day = (date: string | null | undefined) =>
		date ? formatDate(date, i18n.language) : none;
	const terminated = driver.employmentStatus === 'terminated';

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath('drivers')} className="link link-hover w-fit text-sm">
				{t('form.backToList')}
			</Link>
			<ModulePage
				title={`${driver.firstName} ${driver.lastName}`}
				description={`${driver.employeeCode} · ${t(`category.${driver.driverCategory}`)} · ${t(
					`employmentStatus.${driver.employmentStatus}`,
				)}`}
				actions={
					manage && (
						<div className="flex flex-col gap-2 sm:flex-row">
							{!terminated && (
								<button
									type="button"
									className="btn border-0 bg-base-200"
									onClick={() => setDutyOpen(true)}
								>
									{t('duty.open')}
								</button>
							)}
							<Link
								to={companyPath(`drivers/${driver.id}/edit`)}
								className="btn btn-primary md:px-8"
							>
								{t('details.edit')}
							</Link>
						</div>
					)
				}
			/>

			{terminated && (
				<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
					<p className="font-medium">
						{t('details.terminatedTitle', { date: day(driver.terminationDate) })}
					</p>
					<p className="mt-1 text-[var(--color-slate)]">{t('details.terminatedNote')}</p>
				</div>
			)}

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex flex-col gap-6">
					<section
						aria-labelledby="driver-profile-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<h2 id="driver-profile-title" className="text-lg font-semibold">
							{t('details.profile')}
						</h2>
						<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
							<DetailItem label={t('fields.personalMobile')} ltr>
								{driver.personalMobile}
							</DetailItem>
							<DetailItem label={t('fields.personalEmail')} ltr>
								{driver.personalEmail}
							</DetailItem>
							<DetailItem label={t('fields.employmentClassification')}>
								{t(`classification.${driver.employmentClassification}`)}
							</DetailItem>
							<DetailItem label={t('fields.compensationType')}>
								{t(`compensation.${driver.compensationType}`)}
							</DetailItem>
							<DetailItem label={t('fields.hireDate')}>
								{day(driver.hireDate)}
							</DetailItem>
							<DetailItem label={t('fields.employmentStatus')}>
								{t(`employmentStatus.${driver.employmentStatus}`)}
							</DetailItem>
						</dl>
						{manage && (
							<>
								<h3 className="mt-8 font-semibold">{t('details.personal')}</h3>
								<dl className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
									<DetailItem label={t('fields.nationalId')} ltr>
										{driver.nationalId ?? none}
									</DetailItem>
									<DetailItem label={t('fields.dateOfBirth')}>
										{day(driver.dateOfBirth)}
									</DetailItem>
									<DetailItem label={t('fields.residentialAddress')}>
										{driver.residentialAddress ?? none}
									</DetailItem>
									<DetailItem
										label={t('details.emergencyContact')}
										note={
											driver.emergencyContactPhone && (
												<span dir="ltr">
													{driver.emergencyContactPhone}
												</span>
											)
										}
									>
										{driver.emergencyContactName ?? none}
									</DetailItem>
								</dl>
							</>
						)}
					</section>

					<section
						aria-labelledby="driver-vehicle-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<h2 id="driver-vehicle-title" className="text-lg font-semibold">
							{t('details.vehicle')}
						</h2>
						<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
							<DetailItem label={t('fields.driverCategory')}>
								{t(`category.${driver.driverCategory}`)}
							</DetailItem>
							<DetailItem label={t('fields.fleetArrangement')}>
								{t(`fleet.${driver.fleetArrangement}`)}
							</DetailItem>
							<DetailItem label={t('fields.assignedZone')}>
								{driver.assignedZone ?? none}
							</DetailItem>
							<DetailItem label={t('details.capacity')}>
								{t('details.capacityValue', {
									weight: driver.maxWeightCapacityKg,
									volume: driver.maxVolumeCapacityM3,
								})}
							</DetailItem>
						</dl>
					</section>

					{can('drivers.view_compliance') && (
						<section
							aria-labelledby="driver-compliance-title"
							className="rounded-box border border-base-300 p-4 md:p-8"
						>
							<h2 id="driver-compliance-title" className="text-lg font-semibold">
								{t('details.compliance')}
							</h2>
							<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
								<DetailItem
									label={t('fields.licenseNumber')}
									note={t('details.licenseClass', {
										licenseClass: driver.licenseClass ?? none,
									})}
									ltr
								>
									{driver.licenseNumber ?? none}
								</DetailItem>
								<DetailItem label={t('fields.licenseExpiryDate')}>
									{driver.licenseExpiryDate ? (
										<ExpiryDate date={driver.licenseExpiryDate} />
									) : (
										none
									)}
								</DetailItem>
								<DetailItem
									label={t('details.backgroundCheck')}
									note={
										driver.backgroundCheckDate &&
										t('details.checkedOn', {
											date: day(driver.backgroundCheckDate),
										})
									}
								>
									{driver.backgroundCheckPassed
										? t('details.checkPassed')
										: t('details.checkPending')}
								</DetailItem>
								<DetailItem
									label={t('fields.transitInsurancePolicy')}
									note={
										driver.transitInsuranceExpiry && (
											<ExpiryDate date={driver.transitInsuranceExpiry} />
										)
									}
								>
									{driver.transitInsurancePolicy ?? t('details.noInsurance')}
								</DetailItem>
							</dl>
						</section>
					)}
				</div>

				<aside className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">{t('details.duty')}</h2>
						<dl className="mt-6 flex flex-col gap-5">
							<DetailItem
								label={t('details.dutyStatus')}
								note={
									driver.lastLocationPing
										? t('details.lastPing', {
												time: formatDate(
													driver.lastLocationPing,
													i18n.language,
													{
														dateStyle: 'medium',
														timeStyle: 'short',
													},
												),
											})
										: t('details.noPing')
								}
							>
								<DutyStatusBadge status={driver.dispatchStatus} />
							</DetailItem>
							<DetailItem
								label={t('details.account')}
								note={!driver.account && manage && t('details.noAccountNote')}
							>
								{driver.account?.username ?? t('details.noAccount')}
							</DetailItem>
						</dl>
						{manage && (
							<button
								type="button"
								className="btn btn-sm mt-6 border-0 bg-base-100"
								onClick={() => setAccountOpen(true)}
							>
								{driver.account ? t('account.unlink') : t('account.link')}
							</button>
						)}
					</section>

					{(can('drivers.view_earnings') || can('staff.view_payroll')) && (
						<section className="rounded-box bg-base-200 p-6 md:p-8">
							<h2 className="text-lg font-semibold">{t('details.pay')}</h2>
							<dl className="mt-6 flex flex-col gap-5">
								{can('drivers.view_earnings') && (
									<DetailItem
										label={t('fields.commissionPerDrop')}
										ltr
										valueClassName="text-lg font-semibold"
									>
										{driver.commissionPerDrop ?? none}
									</DetailItem>
								)}
								{can('staff.view_payroll') && (
									<>
										<DetailItem
											label={t('fields.baseSalary')}
											ltr
											valueClassName="text-lg font-semibold"
										>
											{driver.baseSalary ?? none}
										</DetailItem>
										<DetailItem
											label={t('fields.bankName')}
											note={
												driver.bankAccountIban && (
													<span dir="ltr">{driver.bankAccountIban}</span>
												)
											}
										>
											{driver.bankName ?? none}
										</DetailItem>
									</>
								)}
							</dl>
						</section>
					)}
					<TipCard
						title={t('details.tipTitle')}
						description={t('details.tipDescription')}
					/>
				</aside>
			</div>

			{dutyOpen && <DutyStatusDialog driver={driver} onClose={() => setDutyOpen(false)} />}
			{accountOpen && (
				<LinkAccountDialog driver={driver} onClose={() => setAccountOpen(false)} />
			)}
		</div>
	);
}
