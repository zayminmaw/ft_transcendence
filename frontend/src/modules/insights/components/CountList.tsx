import { formatNumber } from '@utils/format';
import { useTranslation } from 'react-i18next';

// A short list of names with a count and a bar sized against the largest count. With no counts it says so.
export function CountList({
	title,
	items,
	empty,
}: {
	title: string;
	items: { key: string; label: string; count: number }[];
	empty: string;
}) {
	const { i18n } = useTranslation('insights');
	const largest = Math.max(0, ...items.map((item) => item.count));
	return (
		<section aria-label={title} className="rounded-box bg-base-200 p-6">
			<h2 className="text-sm font-medium">{title}</h2>
			{items.length === 0 ? (
				<p className="mt-4 text-sm text-[var(--color-slate)]">{empty}</p>
			) : (
				<ul className="mt-4 flex flex-col gap-3">
					{items.map((item) => (
						<li key={item.key}>
							<div className="flex items-baseline justify-between gap-4 text-sm">
								<span>{item.label}</span>
								<span className="font-medium">
									{formatNumber(item.count, i18n.language)}
								</span>
							</div>
							<div className="mt-1 h-1.5 rounded-full bg-base-300" aria-hidden="true">
								<div
									className="h-full rounded-full bg-primary"
									style={{
										width:
											largest > 0 ? `${(item.count / largest) * 100}%` : '0%',
									}}
								/>
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
