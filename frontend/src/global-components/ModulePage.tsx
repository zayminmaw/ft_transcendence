import { useEffect } from 'react';
import type { ReactNode } from 'react';

export function ModulePage({
	title,
	description,
	actions,
}: {
	title: string;
	description: string;
	actions?: ReactNode;
}) {
	useEffect(() => {
		document.title = `${title} — Transcend`;
	}, [title]);

	return (
		<section
			aria-labelledby="workspace-page-title"
			className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
		>
			<div>
				<h1
					id="workspace-page-title"
					className="workspace-title text-[2rem] md:text-[2.5rem]"
				>
					{title}
				</h1>
				<p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--color-slate)]">
					{description}
				</p>
			</div>
			{actions}
		</section>
	);
}
