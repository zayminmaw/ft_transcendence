import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ModulePage } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { assetErrorKey } from '../utils/errors';

// Shown instead of an asset page when the asset couldn't be loaded, e.g. it isn't in this company.
export function AssetNotFound({ error }: { error: unknown }) {
	const { t } = useTranslation('assets');
	const companyPath = useCompanyPath();
	return (
		<ModulePage
			title={t('details.notFound')}
			description={t(assetErrorKey(error))}
			actions={
				<Link to={companyPath('assets')} className="btn btn-primary">
					{t('form.backToList')}
				</Link>
			}
		/>
	);
}
