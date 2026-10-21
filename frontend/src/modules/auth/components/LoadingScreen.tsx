import { useTranslation } from 'react-i18next';

export function LoadingScreen() {
	const { t } = useTranslation('auth');
	return (
		<div role="status" className="grid min-h-dvh place-items-center bg-base-100">
			<span className="loading loading-spinner loading-md" aria-hidden="true" />
			<span className="sr-only">{t('loading')}</span>
		</div>
	);
}
