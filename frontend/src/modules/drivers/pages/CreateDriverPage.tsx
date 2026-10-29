import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ModulePage, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { DriverForm } from '../components/DriverForm';
import { DRIVER_DEFAULT_VALUES } from '../constants';

// /drivers/new, for drivers.manage.
export function CreateDriverPage() {
	const { t } = useTranslation('drivers');
	const companyPath = useCompanyPath();

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath('drivers')} className="link link-hover w-fit text-sm">
				{t('form.backToList')}
			</Link>
			<ModulePage title={t('form.newTitle')} description={t('form.description')} />
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<DriverForm defaultValues={DRIVER_DEFAULT_VALUES} />
				<TipCard title={t('form.tipTitle')} description={t('form.tipDescription')} />
			</div>
		</div>
	);
}
