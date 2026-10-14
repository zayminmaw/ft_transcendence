import type { AnalyticsItem } from './types';

export function AnalyticsCard({
	items,
	className = '',
}: {
	items: AnalyticsItem[];
	className?: string;
}) {
	return (
		<dl
			className={`-mx-6 grid grid-cols-2 gap-x-4 gap-y-6 bg-base-200 p-6 md:mx-0 md:grid-cols-4 md:rounded-box ${className}`}
		>
			{items.map((item) => (
				<div key={item.label} className="flex flex-col">
					<dt className="text-xs text-[var(--color-slate)]">{item.label}</dt>
					<dd className="mt-1 text-[2rem] font-medium leading-tight">{item.value}</dd>
					{item.description && (
						<dd className="mt-1 text-xs text-[var(--color-slate)]">
							{item.description}
						</dd>
					)}
				</div>
			))}
		</dl>
	);
}
