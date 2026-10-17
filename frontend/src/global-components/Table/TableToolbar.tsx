import { useTranslation } from 'react-i18next';
import { SelectFilter } from '../SelectFilter/SelectFilter';
import type { TableFilterProps, TableSearchProps } from './types';

export function TableToolbar({
	search,
	filter,
}: {
	search?: TableSearchProps;
	filter?: TableFilterProps;
}) {
	const { t } = useTranslation();

	return (
		<div className="flex flex-wrap items-center gap-2">
			{search && (
				<label className="input w-full sm:w-64">
					<svg
						aria-hidden="true"
						className="h-[1em] text-[var(--color-slate)]"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<circle cx="11" cy="11" r="8" />
						<path d="m21 21-4.3-4.3" />
					</svg>
					<input
						type="search"
						aria-label={search.placeholder ?? t('table.search')}
						placeholder={search.placeholder ?? t('table.search')}
						value={search.value}
						onChange={(event) => search.onChange(event.target.value)}
					/>
				</label>
			)}
			{filter && <SelectFilter {...filter} />}
		</div>
	);
}
