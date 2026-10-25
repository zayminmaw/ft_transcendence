import { Input } from '@global-components';
import type { TenantMember } from '../api';
import { MEMBER_LIST_LIMIT } from '../constants';

// One search box over one list of radio rows: what is typed narrows the rows, and a row is the choice.
export function MemberPicker({
	tenantName,
	search,
	onSearch,
	members,
	isPending,
	isError,
	value,
	onChange,
	onCreateNew,
}: {
	tenantName: string;
	search: string;
	onSearch: (search: string) => void;
	members: TenantMember[];
	isPending: boolean;
	isError: boolean;
	value: string;
	onChange: (userId: string) => void;
	onCreateNew: () => void;
}) {
	// Nobody to choose and nothing typed: the company has no candidates, so there is nothing to search either.
	if (!search && !isPending && !isError && members.length === 0) {
		return (
			<div role="status" className="rounded-box border border-base-300 p-4 text-sm">
				<p className="font-medium">{tenantName} has no members to choose.</p>
				<p className="mt-1 text-[var(--color-slate)]">
					Current and removed members appear here, except its administrators.
				</p>
				<button
					type="button"
					className="btn btn-sm mt-3 border-0 bg-base-200"
					onClick={onCreateNew}
				>
					Create a new account instead
				</button>
			</div>
		);
	}

	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="sr-only">Member</legend>
			<Input
				label="Member *"
				type="search"
				placeholder="Search by username or email"
				autoComplete="off"
				value={search}
				onChange={(event) => onSearch(event.target.value)}
			/>
			<div className="max-h-64 overflow-y-auto rounded-box border border-base-300">
				{isPending ? (
					<p className="p-4 text-sm text-[var(--color-slate)]">Loading members…</p>
				) : isError ? (
					<p role="alert" className="p-4 text-sm text-error">
						Members couldn't be loaded.
					</p>
				) : members.length === 0 ? (
					<p className="p-4 text-sm text-[var(--color-slate)]">
						No members match “{search}”.
					</p>
				) : (
					<ul className="divide-y divide-base-300">
						{members.map((member) => (
							<li key={member.id}>
								<label
									className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-base-200 ${
										value === member.id ? 'bg-base-200' : ''
									}`}
								>
									<input
										type="radio"
										name="assign-member"
										className="radio radio-sm"
										checked={value === member.id}
										onChange={() => onChange(member.id)}
									/>
									<span className="flex min-w-0 flex-1 flex-col">
										<span className="truncate font-medium">
											{member.username}
										</span>
										<span className="truncate text-sm text-[var(--color-slate)]">
											{member.email}
										</span>
									</span>
									<span className="badge badge-sm shrink-0 border-base-300 bg-base-100">
										{member.removed ? 'Removed' : member.role.name}
									</span>
								</label>
							</li>
						))}
					</ul>
				)}
			</div>
			<p className="text-xs text-[var(--color-slate)]">
				{members.length >= MEMBER_LIST_LIMIT
					? `Showing the first ${MEMBER_LIST_LIMIT}. Search to find others. `
					: ''}
				Their company role becomes Tenant administrator. Removed members are added back.
			</p>
		</fieldset>
	);
}
