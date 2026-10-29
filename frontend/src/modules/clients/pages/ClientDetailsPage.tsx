import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { DetailItem, ModulePage, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan } from '@modules/auth';
import { formatDate } from '@utils/format';
import { ArchiveClientDialog } from '../components/ArchiveClientDialog';
import { ClientNotFound } from '../components/ClientNotFound';
import { ClientStatusBadge } from '../components/ClientStatusBadge';
import { useClientDetails } from '../hooks/useClients';
import { isRateTier } from '../utils/rateTier';

// /clients/:clientId: one merchant's profile, pickup point and, with clients.view_financials, balances.
export function ClientDetailsPage() {
	const { clientId = '' } = useParams();
	const { t, i18n } = useTranslation('clients');
	const companyPath = useCompanyPath();
	const can = useCan();
	const { client, isClientPending, clientError } = useClientDetails(clientId);
	const [confirmOpen, setConfirmOpen] = useState(false);

	if (isClientPending)
		return <span className="loading loading-spinner" aria-label={t('page.loading')} />;
	if (!client) return <ClientNotFound error={clientError} />;

	const none = t('details.none');
	const balance = client.currentBalance;
	const tier = client.rateProfileTier;

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath('clients')} className="link link-hover w-fit text-sm">
				{t('form.backToList')}
			</Link>
			<ModulePage
				title={client.businessName}
				description={`${client.clientCode} · ${t('details.since', {
					date: formatDate(client.createdAt, i18n.language),
				})}`}
				actions={
					<div className="flex flex-col gap-2 sm:flex-row">
						{can('clients.delete') && (
							<button
								type="button"
								className="btn border-0 bg-base-200"
								onClick={() => setConfirmOpen(true)}
							>
								{client.isActive ? t('archive.archive') : t('archive.reactivate')}
							</button>
						)}
						{can('clients.edit') && (
							<Link
								to={companyPath(`clients/${client.id}/edit`)}
								className="btn btn-primary md:px-8"
							>
								{t('details.edit')}
							</Link>
						)}
					</div>
				}
			/>

			{!client.isActive && (
				<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
					<p className="font-medium">{t('details.archivedTitle')}</p>
					<p className="mt-1 text-[var(--color-slate)]">{t('details.archivedNote')}</p>
				</div>
			)}

			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex flex-col gap-6">
					<section
						aria-labelledby="client-contact-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<div className="flex items-center justify-between gap-4">
							<h2 id="client-contact-title" className="text-lg font-semibold">
								{t('details.contact')}
							</h2>
							<ClientStatusBadge active={client.isActive} />
						</div>
						<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
							<DetailItem label={t('fields.contactPersonName')}>
								{client.contactPersonName}
							</DetailItem>
							<DetailItem label={t('fields.contactTitle')}>
								{client.contactTitle ?? none}
							</DetailItem>
							<DetailItem label={t('fields.mobile1')} ltr>
								{client.mobile1}
							</DetailItem>
							<DetailItem label={t('fields.mobile2')} ltr>
								{client.mobile2 ?? none}
							</DetailItem>
							<DetailItem label={t('fields.email')} ltr>
								{client.email}
							</DetailItem>
							<DetailItem label={t('fields.tradeLicenseNo')}>
								{client.tradeLicenseNo ?? none}
							</DetailItem>
						</dl>
					</section>

					<section
						aria-labelledby="client-addresses-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<h2 id="client-addresses-title" className="text-lg font-semibold">
							{t('details.addresses')}
						</h2>
						<dl className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
							<DetailItem
								label={t('fields.defaultPickupAddress')}
								note={
									client.pickupLatitude && client.pickupLongitude ? (
										<a
											className="link"
											href={`https://www.openstreetmap.org/?mlat=${client.pickupLatitude}&mlon=${client.pickupLongitude}#map=17/${client.pickupLatitude}/${client.pickupLongitude}`}
											target="_blank"
											rel="noreferrer"
											dir="ltr"
										>
											{client.pickupLatitude}, {client.pickupLongitude}
										</a>
									) : (
										t('details.noPin')
									)
								}
							>
								{client.defaultPickupAddress}
							</DetailItem>
							<DetailItem label={t('fields.billingAddress')}>
								{client.billingAddress}
							</DetailItem>
						</dl>
					</section>

					<section
						aria-labelledby="client-notes-title"
						className="rounded-box border border-base-300 p-4 md:p-8"
					>
						<h2 id="client-notes-title" className="text-lg font-semibold">
							{t('fields.operationalNotes')}
						</h2>
						<p className="mt-4 whitespace-pre-line">
							{client.operationalNotes ?? t('details.noNotes')}
						</p>
					</section>
				</div>

				<aside className="flex flex-col gap-6">
					{can('clients.view_financials') && (
						<section className="rounded-box bg-base-200 p-6 md:p-8">
							<h2 className="text-lg font-semibold">{t('details.financials')}</h2>
							<dl className="mt-6 flex flex-col gap-5">
								<DetailItem
									label={t('details.balance')}
									ltr
									valueClassName="text-lg font-semibold"
									note={
										balance &&
										balance !== '0.00' &&
										(balance.startsWith('-')
											? t('details.merchantOwes')
											: t('details.payoutDue'))
									}
								>
									{balance ?? none}
								</DetailItem>
								<DetailItem
									label={t('details.pendingCod')}
									ltr
									valueClassName="text-lg font-semibold"
								>
									{client.pendingCodBalance ?? none}
								</DetailItem>
								<DetailItem label={t('details.unbilled')} valueClassName="text-sm">
									{t('details.unbilledLater')}
								</DetailItem>
								<DetailItem
									label={t('fields.rateProfileTier')}
									valueClassName="text-lg font-semibold"
								>
									{isRateTier(tier) ? t(`tiers.${tier}`) : (tier ?? none)}
								</DetailItem>
							</dl>
						</section>
					)}
					<TipCard
						title={t('details.tipTitle')}
						description={t('details.tipDescription')}
					/>
				</aside>
			</div>

			<ArchiveClientDialog
				client={client}
				open={confirmOpen}
				onClose={() => setConfirmOpen(false)}
			/>
		</div>
	);
}
