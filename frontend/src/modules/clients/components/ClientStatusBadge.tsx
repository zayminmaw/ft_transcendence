import { useTranslation } from 'react-i18next';

export function ClientStatusBadge({ active }: { active: boolean }) {
	const { t } = useTranslation('clients');
	return (
		<span className={`badge badge-sm ${active ? 'badge-success badge-soft' : 'badge-ghost'}`}>
			{active ? t('status.active') : t('status.archived')}
		</span>
	);
}
