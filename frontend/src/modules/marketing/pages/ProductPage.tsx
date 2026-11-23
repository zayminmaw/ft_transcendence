import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageIntro } from '../components/PageIntro';
import { WorkflowPreview } from '../components/WorkflowPreview';

const domains = ['merchants', 'parcels', 'people', 'billing'] as const;

export function ProductPage() {
	const { t } = useTranslation('marketing');
	return (
		<>
			<PageIntro
				eyebrow={t('product.eyebrow')}
				title={t('product.title')}
				description={t('product.description')}
			/>
			<section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 md:px-10 lg:grid-cols-2">
				<div>
					{domains.map((domain, index) => (
						<article key={domain} className="border-t border-base-300 py-7">
							<span className="text-xs font-semibold text-base-content">
								0{index + 1}
							</span>
							<h2 className="mt-3 text-2xl font-semibold">
								{t(`product.domains.${domain}.title`)}
							</h2>
							<p className="mt-3 max-w-lg leading-relaxed opacity-65">
								{t(`product.domains.${domain}.text`)}
							</p>
						</article>
					))}
				</div>
				<div className="lg:pt-7">
					<WorkflowPreview />
					<div className="mt-8 rounded-xl border border-base-300 p-6">
						<h2 className="font-semibold">{t('product.previewTitle')}</h2>
						<p className="mt-3 text-sm leading-relaxed opacity-65">
							{t('product.previewText')}
						</p>
						<Link to="/app" className="btn btn-outline mt-5">
							{t('product.openPreview')}{' '}
							<span aria-hidden="true" className="inline-block rtl:-scale-x-100">
								↗
							</span>
						</Link>
					</div>
				</div>
			</section>
		</>
	);
}
