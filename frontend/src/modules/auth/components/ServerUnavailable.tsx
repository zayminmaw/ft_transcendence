import { useTranslation } from 'react-i18next';
import { Button } from '@global-components';
import { CenteredPage } from './CenteredPage';

// The server didn't answer (down, restarting, too busy). The session may be fine, so this offers Try again rather
// than the login page.
export function ServerUnavailable({ onRetry }: { onRetry: () => void }) {
	const { t } = useTranslation('auth');
	return (
		<CenteredPage title={t('unavailable.title')} description={t('unavailable.description')}>
			<Button className="w-fit" onClick={onRetry}>
				{t('picker.retry')}
			</Button>
		</CenteredPage>
	);
}
