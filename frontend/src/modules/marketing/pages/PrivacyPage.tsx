import { useTranslation } from 'react-i18next';
import { PageIntro } from '../components/PageIntro';

const sections = ['collect', 'telemetry', 'security', 'oauth', 'retention', 'updates'] as const;

export function PrivacyPage() {
	const { t } = useTranslation('marketing');
	return (
		<>
			<PageIntro
				eyebrow={t('legal.eyebrow')}
				title={t('legal.privacy.title')}
				description={t('legal.privacy.description')}
			/>
			<section className="mx-auto max-w-7xl px-6 pb-24 md:px-10">
				<div className="max-w-4xl space-y-10">
					{sections.map((section) => (
						<article key={section} className="border-t border-base-300 pt-8">
							<h2 className="text-xl font-semibold tracking-tight text-base-content">
								{t(`legal.privacy.sections.${section}.title`)}
							</h2>
							<p className="mt-3 leading-relaxed opacity-75">
								{t(`legal.privacy.sections.${section}.content`)}
							</p>
						</article>
					))}
				</div>
			</section>
		</>
	);
}
