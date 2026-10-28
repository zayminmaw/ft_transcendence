import { useTranslation } from 'react-i18next';
import { Button, Dialog } from '@global-components';
import type { Member } from '../api';

// After creating an account (Figma "Company user created"). The password never appears here.
export function UserCreatedDialog({
	member,
	company,
	onDone,
}: {
	member: Member;
	company: string;
	onDone: () => void;
}) {
	const { t } = useTranslation('rbac');
	return (
		<Dialog
			open
			onClose={onDone}
			title={t('created.title')}
			description={t('created.description', {
				name: member.username,
				role: member.role.name,
				company,
			})}
			actions={<Button onClick={onDone}>{t('created.back')}</Button>}
		>
			<div>
				<p className="text-xs text-[var(--color-slate)]">{t('created.identifier')}</p>
				<p className="mt-1 font-semibold" dir="ltr">
					{member.username} · {member.email}
				</p>
			</div>
			<p className="text-sm text-[var(--color-slate)]">
				{t('created.handover', { name: member.username })}
			</p>
		</Dialog>
	);
}
