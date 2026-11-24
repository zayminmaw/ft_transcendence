import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { WorkflowPreview } from '../components/WorkflowPreview';

const parts = ['desk', 'road', 'books'] as const;
const points = ['merchant', 'roles', 'loop'] as const;
// Mirrors in Arabic, so the arrow points the way the text reads.
const arrow = (
	<span aria-hidden="true" className="inline-block rtl:-scale-x-100">
		→
	</span>
);

export function LandingPage() {
	const { t } = useTranslation('marketing');
	return (
		<>
			<section className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-16 md:px-10 md:py-24 lg:grid-cols-[1.1fr_1fr]">
				<div>
					<p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-base-content">
						{t('landing.eyebrow')}
					</p>
					<h1 className="marketing-title max-w-2xl text-6xl sm:text-7xl lg:text-8xl">
						{t('landing.headlineStart')}
						<br />
						<span className="text-base-content">{t('landing.headlineEnd')}</span>
					</h1>
					<p className="mt-8 max-w-lg text-lg leading-relaxed opacity-70">
						{t('landing.intro')}
					</p>
					<div className="mt-9 flex flex-wrap gap-3">
						<Link to="/product" className="btn btn-primary">
							{t('landing.explore')} {arrow}
						</Link>
						<Link to="/app" className="btn btn-outline">
							{t('landing.viewPreview')}
						</Link>
					</div>
					<p className="mt-5 text-xs opacity-60">{t('landing.builtAround')}</p>
				</div>
				<div className="marketing-grid relative isolate rounded-2xl p-3 sm:p-6">
					<div
						aria-hidden="true"
						className="absolute inset-5 -z-10 rotate-3 rounded-2xl border border-base-300 bg-base-200"
					/>
					<WorkflowPreview />
				</div>
			</section>
			<section className="border-y border-base-300 bg-base-100">
				<div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1fr_2fr] md:px-10">
					<p className="text-sm font-semibold uppercase tracking-wider opacity-60">
						{t('landing.partsStart')}
						<br />
						{t('landing.partsEnd')}
					</p>
					<div className="grid gap-8 sm:grid-cols-3">
						{parts.map((part) => (
							<div key={part}>
								<h2 className="text-lg font-semibold">
									{t(`landing.parts.${part}.title`)}
								</h2>
								<p className="mt-3 text-sm leading-relaxed opacity-65">
									{t(`landing.parts.${part}.text`)}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>
			<section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:px-10 md:py-24 lg:grid-cols-2">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content">
						{t('landing.handoffsEyebrow')}
					</p>
					<h2 className="marketing-title mt-5 text-4xl md:text-5xl">
						{t('landing.handoffsStart')}
						<br />
						{t('landing.handoffsEnd')}
					</h2>
					<p className="mt-6 max-w-lg leading-relaxed opacity-70">
						{t('landing.handoffsText')}
					</p>
					<Link to="/solutions" className="link mt-6 inline-block font-semibold">
						{t('landing.seeTeams')} {arrow}
					</Link>
				</div>
				<div className="space-y-6 border-s border-base-300 ps-8">
					{points.map((point, index) => (
						<div key={point}>
							<span className="text-xs font-semibold text-base-content">
								0{index + 1}
							</span>
							<h3 className="mt-2 text-lg font-semibold">
								{t(`landing.points.${point}.title`)}
							</h3>
							<p className="mt-2 text-sm leading-relaxed opacity-65">
								{t(`landing.points.${point}.text`)}
							</p>
						</div>
					))}
				</div>
			</section>
			<section className="bg-neutral text-neutral-content">
				<div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 py-14 md:flex-row md:items-center md:px-10">
					<div>
						<h2 className="marketing-title text-4xl">{t('landing.ctaTitle')}</h2>
						<p className="mt-4 max-w-xl opacity-70">{t('landing.ctaText')}</p>
					</div>
					<Link to="/contact" className="btn btn-primary">
						{t('landing.ctaButton')} {arrow}
					</Link>
				</div>
			</section>
		</>
	);
}
