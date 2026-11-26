import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Dialog, Input } from '@global-components';
import { useRoleName } from '@modules/auth';
import { fromErrorCode } from '@services/api-client';
import { ACCOUNT_EMAIL_PATTERN, EMAIL_MAX_LENGTH } from '@utils/form-rules';
import type { CreateInviteResponse } from '../api';
import { memberErrorKey } from '../errors';
import { useAssignableRoles, useCreateInvite } from '../hooks';

const schema = z.object({
	roleCode: z.string().min(1, 'create.roleRequired' satisfies ParseKeys<'rbac'>),
	email: z
		.string()
		.trim()
		.refine(
			(value) =>
				value === '' ||
				(value.length <= EMAIL_MAX_LENGTH && ACCOUNT_EMAIL_PATTERN.test(value)),
			'errors.invalidEmail' satisfies ParseKeys<'rbac'>,
		),
});

type FormValues = z.infer<typeof schema>;

const FIELD_CODES = {
	INVALID_EMAIL: 'email',
	INVITE_EMAIL_TAKEN: 'email',
	ROLE_NOT_ASSIGNABLE: 'roleCode',
} as const;

export function CreateInviteDialog({
	company,
	onCreated,
	onClose,
}: {
	company: string;
	onCreated: (result: CreateInviteResponse) => void;
	onClose: () => void;
}) {
	const { t } = useTranslation('rbac');
	const roleName = useRoleName();
	const roles = useAssignableRoles();
	const create = useCreateInvite();
	const roleId = useId();
	const formId = useId();
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: { roleCode: '', email: '' },
	});

	const fieldError = (key?: string) => key && t(key as ParseKeys<'rbac'>);
	const formError = create.isError && !fromErrorCode(FIELD_CODES, create.error);

	const onSubmit = handleSubmit((values) => {
		create.mutate(
			{ roleCode: values.roleCode, email: values.email.trim() || null },
			{
				onSuccess: onCreated,
				onError: (error) => {
					const field = fromErrorCode(FIELD_CODES, error);
					if (field) setError(field, { message: memberErrorKey(error) });
				},
			},
		);
	});

	return (
		<Dialog
			open
			onClose={onClose}
			title={t('invites.createTitle')}
			description={t('invites.createDescription', { company })}
			actions={
				<>
					<button
						type="button"
						className="btn btn-ghost bg-base-200"
						disabled={create.isPending}
						onClick={onClose}
					>
						{t('create.cancel')}
					</button>
					<Button type="submit" form={formId} disabled={create.isPending}>
						{create.isPending && (
							<span
								className="loading loading-spinner loading-sm"
								aria-hidden="true"
							/>
						)}
						{create.isPending ? t('invites.creating') : t('invites.createSubmit')}
					</Button>
				</>
			}
		>
			<form id={formId} noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
				{formError && (
					<p role="alert" className="alert alert-error alert-soft text-sm">
						{t(memberErrorKey(create.error))}
					</p>
				)}
				<div>
					<label className="mb-2 block text-sm font-medium" htmlFor={roleId}>
						{t('create.role')} *
					</label>
					<select
						id={roleId}
						className={`select w-full ${errors.roleCode ? 'select-error' : ''}`}
						aria-invalid={Boolean(errors.roleCode)}
						disabled={!roles.isSuccess}
						{...register('roleCode')}
					>
						<option value="">{t('create.chooseRole')}</option>
						{roles.data?.map((role) => (
							<option key={role.code} value={role.code}>
								{roleName(role)}
							</option>
						))}
					</select>
					{errors.roleCode?.message && (
						<p role="alert" className="mt-1 text-sm text-error">
							{fieldError(errors.roleCode.message)}
						</p>
					)}
				</div>
				<div>
					<Input
						label={t('invites.emailLabel')}
						type="email"
						autoComplete="off"
						spellCheck={false}
						dir="ltr"
						placeholder={t('invites.emailPlaceholder')}
						error={fieldError(errors.email?.message)}
						{...register('email')}
					/>
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('invites.emailHint')}
					</p>
				</div>
			</form>
		</Dialog>
	);
}
