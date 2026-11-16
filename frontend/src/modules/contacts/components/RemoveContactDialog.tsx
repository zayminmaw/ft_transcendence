import { useTranslation } from 'react-i18next';
import { Dialog, useToast } from '@global-components';
import { shownName } from '@modules/auth';
import { ApiError } from '@services/api-client';
import type { Contact } from '../api';
import { useRemoveContact } from '../hooks/useContactMutations';

// Asks before taking someone out of your contacts. Mounted only while open, so every opening starts clean. The list
// reloads after the call either way, so if the person was already gone they disappear from it.
export function RemoveContactDialog({
	contact,
	onClose,
}: {
	contact: Contact;
	onClose: () => void;
}) {
	const { t } = useTranslation('contacts');
	const { toast } = useToast();
	const remove = useRemoveContact();
	const name = shownName(contact);
	const alreadyGone =
		remove.error instanceof ApiError && remove.error.code === 'CONTACT_NOT_FOUND';

	return (
		<Dialog
			open
			onClose={onClose}
			title={t('remove.title', { name })}
			description={t('remove.description', { name })}
			onSubmit={(event) => {
				event.preventDefault();
				remove.mutate(contact.userId, {
					onSuccess: () => {
						onClose();
						toast({ variant: 'success', title: t('remove.removed', { name }) });
					},
				});
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						{t('remove.cancel')}
					</button>
					<button
						type="submit"
						className="btn btn-neutral"
						disabled={remove.isPending || alreadyGone}
					>
						{t('remove.submit')}
					</button>
				</>
			}
		>
			{remove.isError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{alreadyGone ? t('remove.notFound', { name }) : t('errors.unknown')}
				</p>
			)}
		</Dialog>
	);
}
