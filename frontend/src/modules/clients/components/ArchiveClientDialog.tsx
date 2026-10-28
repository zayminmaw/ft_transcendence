import { useTranslation } from 'react-i18next';
import { Dialog, useToast } from '@global-components';
import type { Client } from '../api';
import { useClientMutations } from '../hooks/useClientMutations';
import { clientErrorKey } from '../utils/errors';

// Archives an active client or reactivates an archived one (clients.delete). Its history stays either way.
export function ArchiveClientDialog({
	client,
	open,
	onClose,
}: {
	client: Client;
	open: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation('clients');
	const { toast } = useToast();
	const { setClientActive, isSettingActive, setActiveError, resetSetActive } =
		useClientMutations();
	const archiving = client.isActive;
	const close = () => {
		resetSetActive();
		onClose();
	};

	return (
		<Dialog
			open={open}
			onClose={close}
			title={
				archiving
					? t('archive.confirmTitle', { name: client.businessName })
					: t('archive.reactivateTitle', { name: client.businessName })
			}
			description={archiving ? t('archive.confirmArchive') : t('archive.confirmReactivate')}
			onSubmit={(event) => {
				event.preventDefault();
				setClientActive(
					{ clientId: client.id, active: !archiving },
					{
						onSuccess: () => {
							close();
							toast({
								variant: 'success',
								title: archiving
									? t('archive.archived', { name: client.businessName })
									: t('archive.reactivated', { name: client.businessName }),
							});
						},
					},
				);
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={close}>
						{t('form.cancel')}
					</button>
					<button type="submit" className="btn btn-neutral" disabled={isSettingActive}>
						{archiving ? t('archive.archive') : t('archive.reactivate')}
					</button>
				</>
			}
		>
			{setActiveError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(clientErrorKey(setActiveError))}
				</p>
			)}
		</Dialog>
	);
}
