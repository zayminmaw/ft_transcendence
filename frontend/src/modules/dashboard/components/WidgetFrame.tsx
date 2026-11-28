import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@global-components';

type WidgetFrameProps = {
	title: string;
	subtitle?: string;
	actionTo?: string;
	actionLabel?: string;
	actionContext?: string;
	badge?: ReactNode;
	isPending?: boolean;
	isError?: boolean;
	onRetry?: () => void;
	className?: string;
	children: ReactNode;
};

// Semantic <article> card with container-query support (@container), 1px hairline border, daisyUI 5 btn/alert
// primitives, and sequential h2 headings under ModulePage h1.
export function WidgetFrame({
	title,
	subtitle,
	actionTo,
	actionLabel,
	actionContext,
	badge,
	isPending = false,
	isError = false,
	onRetry,
	className = '',
	children,
}: WidgetFrameProps) {
	const { t } = useTranslation('dashboard');

	return (
		<article
			className={`@container flex min-w-0 flex-col rounded-box border border-base-300 bg-base-100 p-6 ${className}`}
		>
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="font-semibold text-base-content">{title}</h2>
						{badge}
					</div>
					{subtitle && (
						<p className="mt-1 text-xs leading-relaxed text-[var(--color-slate)]">
							{subtitle}
						</p>
					)}
				</div>
				{actionTo && actionLabel && (
					<Link to={actionTo} className="btn btn-ghost btn-sm shrink-0">
						<span>{actionLabel}</span>
						{actionContext && <span className="sr-only"> {actionContext}</span>}
						<svg
							aria-hidden="true"
							viewBox="0 0 16 16"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							className="size-3.5 rtl:rotate-180"
						>
							<path
								d="M6 3.5L10.5 8L6 12.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</Link>
				)}
			</header>

			<div className="mt-4 flex min-w-0 flex-1 flex-col">
				{isPending ? (
					<div className="flex flex-1 items-center justify-center py-10" aria-busy="true">
						<span className="loading loading-spinner" />
					</div>
				) : isError ? (
					<div
						role="alert"
						className="alert alert-error alert-soft flex flex-wrap items-center justify-between gap-3 text-sm"
					>
						<span>{t('states.loadFailed')}</span>
						{onRetry && (
							<Button className="btn-sm" onClick={onRetry}>
								{t('states.retry')}
							</Button>
						)}
					</div>
				) : (
					children
				)}
			</div>
		</article>
	);
}
