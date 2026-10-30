import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ModulePage } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { clientErrorKey } from '../utils/errors';

// Shown instead of a client page when the client couldn't be loaded, e.g. it isn't in this company.
export function ClientNotFound({ error }: { error: unknown }) {
	const { t } = useTranslation('clients');
	const companyPath = useCompanyPath();
	return (
		<ModulePage
			title={t('details.notFound')}
			description={t(clientErrorKey(error))}
			actions={
				<Link to={companyPath('clients')} className="btn btn-primary">
					{t('form.backToList')}
				</Link>
			}
		/>
	);
}
