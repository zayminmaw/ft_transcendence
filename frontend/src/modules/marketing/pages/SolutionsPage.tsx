import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageIntro } from '../components/PageIntro';

const teams = ['dispatch', 'couriers', 'finance', 'people'] as const;

export function SolutionsPage() {
	const { t } = useTranslation('marketing');
	return (
		<>
			<PageIntro
				eyebrow={t('solutions.eyebrow')}
				title={t('solutions.title')}
				description={t('solutions.description')}
			/>
			<section className="mx-auto max-w-7xl px-6 pb-20 md:px-10">
				{teams.map((team, index) => (
					<article
						key={team}
						className="grid gap-5 border-t border-base-300 py-9 md:grid-cols-[1fr_1.4fr]"
					>
						<div>
							<p className="text-xs font-semibold text-base-content">0{index + 1}</p>
							<h2 className="mt-3 text-xl font-semibold">
								{t(`solutions.teams.${team}.name`)}
							</h2>
						</div>
						<div>
							<h3 className="marketing-title text-3xl">
								{t(`solutions.teams.${team}.question`)}
							</h3>
							<p className="mt-4 max-w-xl leading-relaxed opacity-65">
								{t(`solutions.teams.${team}.text`)}
							</p>
							<p className="mt-5 text-xs font-medium uppercase tracking-wide opacity-60">
								{t(`solutions.teams.${team}.modules`)}
							</p>
						</div>
					</article>
				))}
				<div className="mt-4 flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-base-200 p-6 sm:p-8">
					<p className="text-lg font-semibold">{t('solutions.ctaText')}</p>
					<Link to="/contact" className="btn btn-primary">
						{t('solutions.ctaButton')}
					</Link>
				</div>
			</section>
		</>
	);
}
