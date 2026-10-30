import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ModulePage, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { DriverForm } from '../components/DriverForm';
import { DriverNotFound } from '../components/DriverNotFound';
import { useDriverDetails } from '../hooks/useDrivers';
import { toDriverFormValues } from '../utils/driverFormValues';

// /drivers/:driverId/edit, for drivers.manage.
export function EditDriverPage() {
	const { driverId = '' } = useParams();
	const { t } = useTranslation('drivers');
	const companyPath = useCompanyPath();
	const { driver, isDriverPending, driverError } = useDriverDetails(driverId);

	if (isDriverPending)
		return <span className="loading loading-spinner" aria-label={t('page.loading')} />;
	if (!driver) return <DriverNotFound error={driverError} />;

	return (
		<div className="flex flex-col gap-6">
			<Link
				to={companyPath(`drivers/${driver.id}`)}
				className="link link-hover w-fit text-sm"
			>
				{t('form.backToDriver')}
			</Link>
			<ModulePage
				title={t('form.editTitle', { name: `${driver.firstName} ${driver.lastName}` })}
				description={t('form.description')}
			/>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<DriverForm driver={driver} defaultValues={toDriverFormValues(driver)} />
				<TipCard title={t('form.tipTitle')} description={t('form.tipDescription')} />
			</div>
		</div>
	);
}
