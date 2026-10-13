import type { ReactNode } from 'react';

export type TableSortDirection = 'asc' | 'desc';

export type TableSort = {
	key: string;
	direction: TableSortDirection;
};

export type TableColumn<Row> = {
	key: string;
	header: string;
	cell: (row: Row) => ReactNode;
	sortable?: boolean;
	className?: string;
};

export type TableFilterOption = {
	value: string;
	label: string;
};

export type TableSearchProps = {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
};

export type TableFilterProps = {
	label: string;
	options: TableFilterOption[];
	value: string;
	onChange: (value: string) => void;
};

export type TablePaginationProps = {
	page: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
	onPageSizeChange: (pageSize: number) => void;
	pageSizeOptions?: number[];
};
