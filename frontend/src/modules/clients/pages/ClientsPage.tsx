import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnalyticsCard, ModulePage, Table, TipCard } from '@global-components';
import type { AnalyticsItem, TableColumn } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan, useCurrentWorkspace } from '@modules/auth';
import { formatNumber } from '@utils/format';
import type { Client, ClientStatusFilter } from '../api';
import { ClientStatusBadge } from '../components/ClientStatusBadge';
import { useClients } from '../hooks/useClients';

// Clients / merchants: the company's merchant directory for anyone with clients.view.
export function ClientsPage() {
	const { t, i18n } = useTranslation('clients');
	const companyPath = useCompanyPath();
	const company = useCurrentWorkspace()?.name ?? '';
	const can = useCan();
	const {
		clients,
		total,
		counts,
		isPending,
		search,
		setSearch,
		status,
		setStatus,
		sort,
		setSort,
		page,
		setPage,
		pageSize,
		setPageSize,
	} = useClients();
	const count = (value?: number) => formatNumber(value, i18n.language);
	let emptyMessage = t('table.empty');
	if (isPending) emptyMessage = t('page.loading');
	else if (search.trim()) emptyMessage = t('table.noMatch');

	const clientStats: AnalyticsItem[] = [
		{
			label: t('tiles.active'),
			value: count(counts?.active),
			description: t('tiles.archived', { n: count(counts?.archived) }),
		},
		{
			label: t('tiles.pinned'),
			value: count(counts?.pinned),
			description: t('tiles.pinnedNote'),
		},
		{
			label: t('tiles.total'),
			value: count(counts?.total),
			description: t('tiles.totalNote'),
		},
	];

	const columns: TableColumn<Client>[] = [
		{
			key: 'businessName',
			header: t('table.client'),
			sortable: true,
			cell: (client) => (
				<div>
					<Link
						to={companyPath(`clients/${client.id}`)}
						className="link link-hover font-medium"
					>
						{client.businessName}
					</Link>
					<p className="text-xs text-[var(--color-slate)]">{client.clientCode}</p>
				</div>
			),
		},
		{
			key: 'contact',
			header: t('table.contact'),
			cell: (client) => (
				<div>
					<p>{client.contactPersonName}</p>
					<p className="text-xs text-[var(--color-slate)]" dir="ltr">
						{client.mobile1}
					</p>
				</div>
			),
		},
		{
			key: 'pickup',
			header: t('table.pickup'),
			className: 'max-w-64',
			cell: (client) => <p className="line-clamp-2">{client.defaultPickupAddress}</p>,
		},
		...(can('clients.view_financials')
			? [
					{
						key: 'balance',
						header: t('table.balance'),
						className: 'text-end whitespace-nowrap',
						cell: (client: Client) => client.currentBalance ?? '—',
					},
				]
			: []),
		{
			key: 'status',
			header: t('table.status'),
			cell: (client) => <ClientStatusBadge active={client.isActive} />,
		},
	];

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title={t('page.title')}
				description={t('page.description', { company })}
				actions={
					can('clients.create') && (
						<Link to={companyPath('clients/new')} className="btn btn-primary md:px-8">
							{t('page.create')}
						</Link>
					)
				}
			/>
			<AnalyticsCard items={clientStats} />
			<section className="flex flex-col gap-4">
				<div>
					<h2 className="font-semibold">{t('table.title')}</h2>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('table.description')}
					</p>
				</div>
				<Table
					caption={t('table.title')}
					columns={columns}
					rows={clients}
					getRowKey={(client) => client.id}
					sort={sort}
					onSortChange={setSort}
					search={{ value: search, onChange: setSearch, placeholder: t('table.search') }}
					filter={{
						label: t('table.statusFilter'),
						value: status,
						onChange: (value) => setStatus(value as ClientStatusFilter),
						options: [
							{ value: 'active', label: t('status.active') },
							{ value: 'archived', label: t('status.archived') },
							{ value: 'all', label: t('status.all') },
						],
					}}
					pagination={{
						page,
						pageSize,
						total,
						onPageChange: setPage,
						onPageSizeChange: setPageSize,
					}}
					emptyMessage={emptyMessage}
				/>
			</section>
			<TipCard title={t('tip.title')} description={t('tip.description')} />
		</div>
	);
}
