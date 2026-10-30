import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ModulePage, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { ClientForm } from '../components/ClientForm';
import { CLIENT_DEFAULT_VALUES } from '../constants';

// /clients/new, for clients.create.
export function CreateClientPage() {
	const { t } = useTranslation('clients');
	const companyPath = useCompanyPath();

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath('clients')} className="link link-hover w-fit text-sm">
				{t('form.backToList')}
			</Link>
			<ModulePage title={t('form.newTitle')} description={t('form.description')} />
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<ClientForm defaultValues={CLIENT_DEFAULT_VALUES} />
				<TipCard title={t('form.tipTitle')} description={t('form.tipDescription')} />
			</div>
		</div>
	);
}
