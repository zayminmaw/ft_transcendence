import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@utils/format';
import type { TablePaginationProps } from './types';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50];

// First, last, and the current page with one neighbour each side; gaps collapse to an ellipsis.
function getPageItems(page: number, pageCount: number): (number | 'ellipsis')[] {
	if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
	const start = Math.max(2, Math.min(page - 1, pageCount - 4));
	const end = Math.min(pageCount - 1, Math.max(page + 1, 5));
	const middle = Array.from({ length: end - start + 1 }, (_, index) => start + index);
	return [
		1,
		...(start > 2 ? (['ellipsis'] as const) : []),
		...middle,
		...(end < pageCount - 1 ? (['ellipsis'] as const) : []),
		pageCount,
	];
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
	return (
		<svg
			aria-hidden="true"
			className="h-[1em]"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
		</svg>
	);
}

export function TablePagination({
	page,
	pageSize,
	total,
	onPageChange,
	onPageSizeChange,
	pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: TablePaginationProps) {
	const { t, i18n } = useTranslation();
	const language = i18n.resolvedLanguage ?? 'en';
	const pageSizeId = useId();
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const lastRow = Math.min(page * pageSize, total);

	return (
		<div className="flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
			<div className="flex items-center gap-2 text-[var(--color-slate)]">
				<label htmlFor={pageSizeId}>{t('pagination.rowsPerPage')}</label>
				<select
					id={pageSizeId}
					className="select select-sm w-20 text-base-content"
					value={pageSize}
					onChange={(event) => onPageSizeChange(Number(event.target.value))}
				>
					{pageSizeOptions.map((option) => (
						<option key={option} value={option}>
							{formatNumber(option, language)}
						</option>
					))}
				</select>
				<span className="ms-2">
					{t('pagination.range', {
						first: formatNumber(firstRow, language),
						last: formatNumber(lastRow, language),
						total: formatNumber(total, language),
					})}
				</span>
			</div>
			<nav aria-label={t('pagination.label')} className="flex items-center gap-1">
				<button
					type="button"
					className="btn btn-ghost btn-sm btn-square"
					aria-label={t('pagination.previous')}
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					<Chevron direction="left" />
				</button>
				{getPageItems(page, pageCount).map((item, index) =>
					item === 'ellipsis' ? (
						<span
							key={`ellipsis-${index}`}
							aria-hidden="true"
							className="w-8 text-center text-[var(--color-slate)]"
						>
							…
						</span>
					) : (
						<button
							key={item}
							type="button"
							className={`btn btn-sm btn-square ${item === page ? 'btn-neutral' : 'btn-ghost'}`}
							aria-label={t('pagination.page', {
								page: formatNumber(item, language),
							})}
							aria-current={item === page ? 'page' : undefined}
							onClick={() => onPageChange(item)}
						>
							{formatNumber(item, language)}
						</button>
					),
				)}
				<button
					type="button"
					className="btn btn-ghost btn-sm btn-square"
					aria-label={t('pagination.next')}
					disabled={page >= pageCount}
					onClick={() => onPageChange(page + 1)}
				>
					<Chevron direction="right" />
				</button>
			</nav>
		</div>
	);
}
