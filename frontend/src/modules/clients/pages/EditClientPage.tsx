import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ModulePage, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { ClientForm } from '../components/ClientForm';
import { ClientNotFound } from '../components/ClientNotFound';
import { useClientDetails } from '../hooks/useClients';
import { toClientFormValues } from '../utils/clientFormValues';

// /clients/:clientId/edit, for clients.edit.
export function EditClientPage() {
	const { clientId = '' } = useParams();
	const { t } = useTranslation('clients');
	const companyPath = useCompanyPath();
	const { client, isClientPending, clientError } = useClientDetails(clientId);

	if (isClientPending)
		return <span className="loading loading-spinner" aria-label={t('page.loading')} />;
	if (!client) return <ClientNotFound error={clientError} />;

	return (
		<div className="flex flex-col gap-6">
			<Link
				to={companyPath(`clients/${client.id}`)}
				className="link link-hover w-fit text-sm"
			>
				{t('form.backToClient')}
			</Link>
			<ModulePage
				title={t('form.editTitle', { name: client.businessName })}
				description={t('form.description')}
			/>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<ClientForm client={client} defaultValues={toClientFormValues(client)} />
				<TipCard title={t('form.tipTitle')} description={t('form.tipDescription')} />
			</div>
		</div>
	);
}
