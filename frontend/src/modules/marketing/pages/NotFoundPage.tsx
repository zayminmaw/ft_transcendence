import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageIntro } from '../components/PageIntro';

export function NotFoundPage() {
	const { t } = useTranslation('marketing');
	useEffect(() => {
		document.title = t('notFound.pageTitle');
	}, [t]);

	return (
		<>
			<PageIntro
				eyebrow="404"
				title={t('notFound.title')}
				description={t('notFound.description')}
			/>
			<div className="mx-auto max-w-7xl px-6 pb-24 md:px-10">
				<Link to="/" className="btn btn-primary">
					{t('notFound.back')}
				</Link>
			</div>
		</>
	);
}
