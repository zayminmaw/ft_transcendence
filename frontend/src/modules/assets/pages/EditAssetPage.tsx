import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ModulePage, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { AssetForm } from '../components/AssetForm';
import { AssetNotFound } from '../components/AssetNotFound';
import { useAssetDetails } from '../hooks/useAssets';
import { toAssetFormValues } from '../utils/assetFormValues';

// /assets/:assetId/edit, for assets.create (there is no separate edit permission).
export function EditAssetPage() {
	const { assetId = '' } = useParams();
	const { t } = useTranslation('assets');
	const companyPath = useCompanyPath();
	const { asset, isAssetPending, assetError } = useAssetDetails(assetId);

	if (isAssetPending)
		return <span className="loading loading-spinner" aria-label={t('page.loading')} />;
	if (!asset) return <AssetNotFound error={assetError} />;

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath(`assets/${asset.id}`)} className="link link-hover w-fit text-sm">
				{t('form.backToAsset')}
			</Link>
			<ModulePage
				title={t('form.editTitle', { name: asset.assetName })}
				description={t('form.description')}
			/>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<AssetForm asset={asset} defaultValues={toAssetFormValues(asset)} />
				<TipCard
					title={t('form.editTipTitle')}
					description={t('form.editTipDescription')}
				/>
			</div>
		</div>
	);
}
