import { useEffect } from 'react';

export function ModulePage({ title, description }: { title: string; description: string }) {
	useEffect(() => {
		document.title = `${title} — Transcend`;
	}, [title]);

	return (
		<section aria-labelledby="workspace-page-title">
			<h1 id="workspace-page-title" className="workspace-title text-[2rem] md:text-[2.5rem]">
				{title}
			</h1>
			<p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--color-slate)]">
				{description}
			</p>
		</section>
	);
}
