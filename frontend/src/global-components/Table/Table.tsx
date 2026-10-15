import { useTranslation } from 'react-i18next';
import { TablePagination } from './TablePagination';
import { TableToolbar } from './TableToolbar';
import type {
	TableColumn,
	TableFilterProps,
	TablePaginationProps,
	TableSearchProps,
	TableSort,
	TableSortDirection,
} from './types';

type TableProps<Row> = {
	caption: string;
	columns: TableColumn<Row>[];
	rows: Row[];
	getRowKey: (row: Row) => string;
	sort?: TableSort | null;
	onSortChange?: (sort: TableSort | null) => void;
	search?: TableSearchProps;
	filter?: TableFilterProps;
	pagination?: TablePaginationProps;
	emptyMessage?: string;
	className?: string;
};

// Unsorted → ascending → descending → unsorted.
function getNextSort(key: string, sort?: TableSort | null): TableSort | null {
	if (sort?.key !== key) return { key, direction: 'asc' };
	return sort.direction === 'asc' ? { key, direction: 'desc' } : null;
}

function SortIcon({ direction }: { direction?: TableSortDirection }) {
	return (
		<svg
			aria-hidden="true"
			className={`h-[1em] ${direction ? 'text-base-content' : 'opacity-50'}`}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{direction === 'asc' && <path d="M12 19V5m-6 6 6-6 6 6" />}
			{direction === 'desc' && <path d="M12 5v14m-6-6 6 6 6-6" />}
			{!direction && <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />}
		</svg>
	);
}

export function Table<Row>({
	caption,
	columns,
	rows,
	getRowKey,
	sort,
	onSortChange,
	search,
	filter,
	pagination,
	emptyMessage,
	className = '',
}: TableProps<Row>) {
	const { t } = useTranslation();

	return (
		<div className={`flex flex-col gap-4 ${className}`}>
			{(search || filter) && <TableToolbar search={search} filter={filter} />}
			<div className="overflow-x-auto">
				<table className="table">
					<caption className="sr-only">{caption}</caption>
					<thead>
						<tr className="bg-base-200">
							{columns.map((column) => {
								const direction =
									sort?.key === column.key ? sort.direction : undefined;
								const sortable = column.sortable && onSortChange;
								return (
									<th
										key={column.key}
										scope="col"
										aria-sort={
											direction &&
											(direction === 'asc' ? 'ascending' : 'descending')
										}
										className={`border-0 text-xs font-normal text-[var(--color-slate)] ${column.className ?? ''}`}
									>
										{sortable ? (
											<button
												type="button"
												className="-my-1 flex cursor-pointer items-center gap-2 py-1"
												onClick={() =>
													onSortChange(getNextSort(column.key, sort))
												}
											>
												{column.header}
												<SortIcon direction={direction} />
											</button>
										) : (
											column.header
										)}
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={getRowKey(row)}>
								{columns.map((column) => (
									<td
										key={column.key}
										className={`border-b border-base-300 py-5 ${column.className ?? ''}`}
									>
										{column.cell(row)}
									</td>
								))}
							</tr>
						))}
						{rows.length === 0 && (
							<tr>
								<td
									colSpan={columns.length}
									className="border-b border-base-300 py-12 text-center text-[var(--color-slate)]"
								>
									{emptyMessage ?? t('table.empty')}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			{pagination && <TablePagination {...pagination} />}
		</div>
	);
}
