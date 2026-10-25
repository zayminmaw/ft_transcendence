import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, Input, PasswordInput, useToast } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { ApiError } from '@services/api-client';
import type { AssignAdministratorValues, NewAdministratorValues, TenantDetails } from '../api';
import { NEW_ADMINISTRATOR_DEFAULT_VALUES, NEW_ADMINISTRATOR_FIELD_ERRORS } from '../constants';
import { useTenantMembers } from '../hooks/useTenantAdministrators';
import { useTenantMutations } from '../hooks/useTenantMutations';
import { administratorAccountSchema } from '../schemas/administratorAccountSchema';
import { MemberPicker } from './MemberPicker';

// Mount only while open, so the form and the typed password are gone once it closes.
export function AssignAdministratorDialog({
	tenant,
	onClose,
}: {
	tenant: TenantDetails;
	onClose: () => void;
}) {
	const { toast } = useToast();
	const { assignAdministrator, isAssigning } = useTenantMutations();
	const [mode, setMode] = useState<'new' | 'existing'>('new');
	const [search, setSearch] = useState('');
	const [userId, setUserId] = useState('');
	const [error, setError] = useState<string | null>(null);
	const debouncedSearch = useDebounced(search);
	const { members, isMembersPending, isMembersError } = useTenantMembers(
		tenant.id,
		debouncedSearch,
		mode === 'existing',
	);
	// A choice hidden by a later search no longer counts, so what is assigned is always on screen.
	const chosenId = members.some((member) => member.id === userId) ? userId : '';
	const {
		register,
		handleSubmit,
		setError: setFieldError,
		formState: { errors },
	} = useForm<NewAdministratorValues>({
		resolver: zodResolver(administratorAccountSchema),
		defaultValues: NEW_ADMINISTRATOR_DEFAULT_VALUES,
	});

	const assign = (values: AssignAdministratorValues) => {
		setError(null);
		assignAdministrator(
			{ tenantId: tenant.id, values },
			{
				onSuccess: ({ administrator }) => {
					onClose();
					toast({
						variant: 'success',
						title: 'Administrator assigned',
						description: `${administrator.username} now administers ${tenant.name}.`,
					});
				},
				onError: (failure) => {
					const field =
						values.mode === 'new' && failure instanceof ApiError && failure.code
							? NEW_ADMINISTRATOR_FIELD_ERRORS[
									failure.code as keyof typeof NEW_ADMINISTRATOR_FIELD_ERRORS
								]
							: undefined;
					// The account may be a removed member, who comes back through "Existing member" instead.
					const hint =
						field === 'username' || field === 'email'
							? ` If they were in ${tenant.name} before, choose them under Existing member.`
							: '';
					if (field)
						setFieldError(
							field,
							{ message: failure.message + hint },
							{ shouldFocus: true },
						);
					else setError(failure.message);
				},
			},
		);
	};

	const chooseMode = (next: 'new' | 'existing') => {
		setMode(next);
		setError(null);
	};

	return (
		<Dialog
			open
			onClose={onClose}
			title="Assign administrator"
			description={`The administrator gets tenant permissions in ${tenant.name} only. No platform access is granted.`}
			onSubmit={(event) => {
				if (mode === 'new')
					return handleSubmit((account) => assign({ mode: 'new', account }))(event);
				event.preventDefault();
				assign({ mode: 'existing', userId: chosenId });
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						Cancel
					</button>
					<button
						type="submit"
						className="btn btn-primary"
						disabled={isAssigning || (mode === 'existing' && !chosenId)}
					>
						Assign administrator
					</button>
				</>
			}
		>
			{error && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{error}
				</p>
			)}
			<div role="tablist" aria-label="Administrator source" className="tabs tabs-box">
				<button
					type="button"
					role="tab"
					aria-selected={mode === 'new'}
					className={`tab flex-1 ${mode === 'new' ? 'tab-active' : ''}`}
					onClick={() => chooseMode('new')}
				>
					New account
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={mode === 'existing'}
					className={`tab flex-1 ${mode === 'existing' ? 'tab-active' : ''}`}
					onClick={() => chooseMode('existing')}
				>
					Existing member
				</button>
			</div>

			{/* Keyed, so the account fields and the member search never share an input element. */}
			{mode === 'new' ? (
				<div key="new" className="flex flex-col gap-4">
					<Input
						label="Username"
						required
						autoComplete="off"
						autoCapitalize="none"
						spellCheck={false}
						error={errors.username?.message}
						{...register('username')}
					/>
					<Input
						label="Login email"
						type="email"
						required
						autoComplete="off"
						error={errors.email?.message}
						{...register('email')}
					/>
					<PasswordInput
						label="Initial password"
						required
						autoComplete="new-password"
						error={errors.password?.message}
						{...register('password')}
					/>
					<p className="text-xs text-[var(--color-slate)]">
						Hand over credentials securely. Passwords are hidden from confirmation and
						audit records.
					</p>
				</div>
			) : (
				<MemberPicker
					key="existing"
					tenantName={tenant.name}
					search={search}
					onSearch={setSearch}
					members={members}
					isPending={isMembersPending}
					isError={isMembersError}
					value={chosenId}
					onChange={setUserId}
					onCreateNew={() => chooseMode('new')}
				/>
			)}
		</Dialog>
	);
}
