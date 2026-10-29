import { useTranslation } from 'react-i18next';
import { formatDate } from '@utils/format';
import { expiryState } from '../utils/expiry';

// An expiry date (license, insurance), flagged when it has passed or is close.
export function ExpiryDate({ date }: { date: string }) {
	const { t, i18n } = useTranslation('drivers');
	const state = expiryState(date);
	return (
		<span className="inline-flex flex-wrap items-center gap-2">
			{formatDate(date, i18n.language)}
			{state === 'expired' && (
				<span className="badge badge-sm badge-error badge-soft">{t('expiry.expired')}</span>
			)}
			{state === 'soon' && (
				<span className="badge badge-sm badge-warning badge-soft">{t('expiry.soon')}</span>
			)}
		</span>
	);
}
