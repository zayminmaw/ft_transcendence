import { useState } from 'react';
import type { ParseKeys } from 'i18next';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, Input, PasswordInput, useToast } from '@global-components';
import { useDebounced } from '@hooks/useDebounced';
import { fromErrorCode } from '@services/api-client';
import type { AssignAdministratorValues, NewAdministratorValues, TenantDetails } from '../api';
import { NEW_ADMINISTRATOR_DEFAULT_VALUES, NEW_ADMINISTRATOR_FIELD_ERRORS } from '../constants';
import { useTenantMembers } from '../hooks/useTenantAdministrators';
import { useTenantMutations } from '../hooks/useTenantMutations';
import { administratorAccountSchema } from '../schemas/administratorAccountSchema';
import { MemberPicker } from './MemberPicker';
import { platformErrorKey } from '../errors';

// Mount only while open, so the form and the typed password are gone once it closes.
export function AssignAdministratorDialog({
	tenant,
	onClose,
}: {
	tenant: TenantDetails;
	onClose: () => void;
}) {
	const { t, i18n } = useTranslation('platform');
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
	// Zod messages are translation keys; a server refusal arrives already translated, so it is shown as it is.
	const fieldError = (message?: string) =>
		message &&
		(i18n.exists(message, { ns: 'platform' }) ? t(message as ParseKeys<'platform'>) : message);

	const assign = (values: AssignAdministratorValues) => {
		setError(null);
		assignAdministrator(
			{ tenantId: tenant.id, values },
			{
				onSuccess: ({ administrator }) => {
					onClose();
					toast({
						variant: 'success',
						title: t('assign.assigned'),
						description: t('assign.assignedText', {
							username: administrator.username,
							tenant: tenant.name,
						}),
					});
				},
				onError: (failure) => {
					const field =
						values.mode === 'new'
							? fromErrorCode(NEW_ADMINISTRATOR_FIELD_ERRORS, failure)
							: undefined;
					// The account may be a removed member, who comes back through "Existing member" instead.
					const hint =
						field === 'username' || field === 'email'
							? ` ${t('assign.wasMember', { name: tenant.name })}`
							: '';
					if (field)
						setFieldError(
							field,
							{ message: t(platformErrorKey(failure)) + hint },
							{ shouldFocus: true },
						);
					else setError(t(platformErrorKey(failure)));
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
			title={t('administrators.assign')}
			description={t('assign.description', { name: tenant.name })}
			onSubmit={(event) => {
				if (mode === 'new')
					return handleSubmit((account) => assign({ mode: 'new', account }))(event);
				event.preventDefault();
				assign({ mode: 'existing', userId: chosenId });
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						{t('common.cancel')}
					</button>
					<button
						type="submit"
						className="btn btn-primary"
						disabled={isAssigning || (mode === 'existing' && !chosenId)}
					>
						{t('administrators.assign')}
					</button>
				</>
			}
		>
			{error && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{error}
				</p>
			)}
			<div role="tablist" aria-label={t('assign.source')} className="tabs tabs-box">
				<button
					type="button"
					role="tab"
					aria-selected={mode === 'new'}
					className={`tab flex-1 ${mode === 'new' ? 'tab-active' : ''}`}
					onClick={() => chooseMode('new')}
				>
					{t('assign.newAccount')}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={mode === 'existing'}
					className={`tab flex-1 ${mode === 'existing' ? 'tab-active' : ''}`}
					onClick={() => chooseMode('existing')}
				>
					{t('assign.existingMember')}
				</button>
			</div>

			{/* Keyed, so the account fields and the member search never share an input element. */}
			{mode === 'new' ? (
				<div key="new" className="flex flex-col gap-4">
					<Input
						label={t('fields.username')}
						required
						autoComplete="off"
						autoCapitalize="none"
						spellCheck={false}
						dir="ltr"
						error={fieldError(errors.username?.message)}
						{...register('username')}
					/>
					<Input
						label={t('fields.loginEmail')}
						type="email"
						required
						autoComplete="off"
						error={fieldError(errors.email?.message)}
						{...register('email')}
					/>
					<PasswordInput
						label={t('fields.initialPassword')}
						required
						autoComplete="new-password"
						error={fieldError(errors.password?.message)}
						{...register('password')}
					/>
					<p className="text-xs text-[var(--color-slate)]">
						{t('assign.credentialsNote')}
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
