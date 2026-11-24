import { useTranslation } from 'react-i18next';
import { ModulePage } from '@global-components';

export function PlatformNotFoundPage() {
	const { t } = useTranslation('platform');
	return <ModulePage title={t('common.notFoundTitle')} description={t('common.notFound')} />;
}
