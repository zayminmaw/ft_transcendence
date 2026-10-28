import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LanguageSwitcher } from '@global-components';

// The picker, "no access" and "not found" pages: the logo, a title and the content, outside any workspace.
export function CenteredPage({
	title,
	subtitle,
	description,
	children,
}: {
	title: string;
	// A line right under the title, e.g. who is logged in.
	subtitle?: string;
	description: string;
	children: ReactNode;
}) {
	useEffect(() => {
		document.title = `${title} — Transcend`;
	}, [title]);

	return (
		<div className="min-h-dvh bg-base-100 px-4 py-10 text-base-content sm:px-6 md:py-24">
			<main className="mx-auto flex w-full max-w-xl flex-col gap-8">
				<div className="flex items-center justify-between gap-4">
					<Link to="/" className="workspace-title text-[2rem]">
						transcend
					</Link>
					<LanguageSwitcher />
				</div>
				<div>
					<h1 className="workspace-title text-[2rem] md:text-[2.25rem]">{title}</h1>
					{subtitle && <p className="mt-2 text-sm font-medium">{subtitle}</p>}
					<p className="mt-2 text-sm text-[var(--color-slate)]">{description}</p>
				</div>
				{children}
			</main>
		</div>
	);
}
