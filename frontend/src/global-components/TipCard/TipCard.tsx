import type { ReactNode } from 'react';

// Graphite aside card explaining the rule behind the current page's action.
export function TipCard({
	title,
	description,
	footer,
	className = '',
}: {
	title: string;
	description: ReactNode;
	footer?: ReactNode;
	className?: string;
}) {
	return (
		<section className={`rounded-box bg-neutral p-6 text-neutral-content md:p-8 ${className}`}>
			<h2 className="workspace-title text-[2rem]">{title}</h2>
			<p className="mt-6 leading-relaxed">{description}</p>
			{footer && (
				<div className="mt-6 border-t border-neutral-content/30 pt-4 text-xs">{footer}</div>
			)}
		</section>
	);
}
