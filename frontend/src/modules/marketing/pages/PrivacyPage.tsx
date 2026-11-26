import { useTranslation } from 'react-i18next';
import { formatDate } from '@utils/format';
import { PageIntro } from '../components/PageIntro';

const sections = [
	'collect',
	'telemetry',
	'security',
	'oauth',
	'cookies',
	'retention',
	'updates',
] as const;
// Change this whenever the policy text changes.
const LAST_UPDATED = '2026-11-26';

export function PrivacyPage() {
	const { t, i18n } = useTranslation('marketing');
	return (
		<>
			<PageIntro
				eyebrow={t('legal.eyebrow')}
				title={t('legal.privacy.title')}
				description={t('legal.privacy.description')}
			/>
			<section className="mx-auto max-w-7xl px-6 pb-24 md:px-10">
				<div className="max-w-4xl space-y-10">
					<p className="text-sm opacity-65">
						{t('legal.updated', {
							date: formatDate(LAST_UPDATED, i18n.resolvedLanguage ?? 'en', {
								dateStyle: 'long',
							}),
						})}
					</p>
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
