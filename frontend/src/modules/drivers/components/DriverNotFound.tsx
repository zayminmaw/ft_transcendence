import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ModulePage } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { driverErrorKey } from '../utils/errors';

// Shown instead of a driver page when the driver couldn't be loaded, e.g. they aren't in this company.
export function DriverNotFound({ error }: { error: unknown }) {
	const { t } = useTranslation('drivers');
	const companyPath = useCompanyPath();
	return (
		<ModulePage
			title={t('details.notFound')}
			description={t(driverErrorKey(error))}
			actions={
				<Link to={companyPath('drivers')} className="btn btn-primary">
					{t('form.backToList')}
				</Link>
			}
		/>
	);
}
