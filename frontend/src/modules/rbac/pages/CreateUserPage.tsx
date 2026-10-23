import { useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button, Input, ModulePage, PasswordInput, TipCard } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCurrentWorkspace } from '@modules/auth';
import { meetsPasswordRule } from '@utils/password';
import type { Member, NewMember } from '../api';
import { UserCreatedDialog } from '../components/UserCreatedDialog';
import { errorCode, memberErrorKey } from '../errors';
import { useAssignableRoles, useCreateMember } from '../hooks';

// The same checks as the API (users/accounts.ts), so most mistakes are caught before sending. The messages are
// translation keys, translated when shown.
const schema = z.object({
	username: z
		.string()
		.trim()
		.regex(/^[A-Za-z0-9._-]{3,64}$/, 'errors.invalidUsername' satisfies ParseKeys<'rbac'>),
	email: z
		.string()
		.trim()
		.max(191, 'errors.invalidEmail' satisfies ParseKeys<'rbac'>)
		.regex(
			/^[\x21-\x3F\x41-\x7E]+@[\x21-\x3F\x41-\x7E]+\.[\x21-\x3F\x41-\x7E]+$/,
			'errors.invalidEmail' satisfies ParseKeys<'rbac'>,
		),
	password: z
		.string()
		.refine(meetsPasswordRule, 'errors.passwordRule' satisfies ParseKeys<'rbac'>),
	roleCode: z.string().min(1, 'create.roleRequired' satisfies ParseKeys<'rbac'>),
});

// API codes that belong under one field; the rest show above the form.
const FIELD_CODES = {
	INVALID_USERNAME: 'username',
	INVALID_EMAIL: 'email',
	PASSWORD_RULE: 'password',
	ROLE_NOT_ASSIGNABLE: 'roleCode',
} as const;

export function CreateUserPage() {
	const { t } = useTranslation('rbac');
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const company = useCurrentWorkspace()?.name ?? '';
	const roles = useAssignableRoles();
	const create = useCreateMember();
	const [created, setCreated] = useState<Member | null>(null);
	const roleId = useId();
	const {
		register,
		handleSubmit,
		setError,
		control,
		formState: { errors },
	} = useForm<NewMember>({
		resolver: zodResolver(schema),
		defaultValues: { username: '', email: '', password: '', roleCode: '' },
	});
	const [username, roleCode] = useWatch({ control, name: ['username', 'roleCode'] });
	const roleName = roles.data?.find((role) => role.code === roleCode)?.name;
	const fieldError = (key?: string) => key && t(key as ParseKeys<'rbac'>);
	const code = errorCode(create.error);
	const formError = create.isError && !(code && code in FIELD_CODES);
	const backToList = () => navigate(companyPath('rbac'));

	const review = [
		{ label: t('create.reviewCompany'), value: company },
		{ label: t('create.reviewUser'), value: username.trim() || '—' },
		{ label: t('create.reviewRole'), value: roleName ?? '—' },
		{ label: t('create.reviewAccess'), value: t('create.reviewAccessValue') },
	];

	return (
		<div className="flex flex-col gap-6">
			<Link to={companyPath('rbac')} className="link link-hover w-fit text-sm">
				{t('create.back')}
			</Link>
			<ModulePage
				title={t('create.title')}
				description={t('create.description', { company })}
			/>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<form
					noValidate
					className="flex flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8"
					onSubmit={handleSubmit((values) =>
						create.mutate(values, {
							onSuccess: setCreated,
							onError: (error) => {
								const known = errorCode(error);
								if (known && known in FIELD_CODES)
									setError(FIELD_CODES[known as keyof typeof FIELD_CODES], {
										message: memberErrorKey(error),
									});
							},
						}),
					)}
				>
					{formError && (
						<p role="alert" className="alert alert-error alert-soft text-sm">
							{t(memberErrorKey(create.error))}
						</p>
					)}
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<Input
							label={t('create.username')}
							required
							autoComplete="off"
							autoCapitalize="none"
							spellCheck={false}
							error={fieldError(errors.username?.message)}
							{...register('username')}
						/>
						<Input
							label={t('create.email')}
							type="email"
							required
							autoComplete="off"
							spellCheck={false}
							error={fieldError(errors.email?.message)}
							{...register('email')}
						/>
					</div>
					<div>
						<PasswordInput
							label={t('create.password')}
							required
							autoComplete="new-password"
							error={fieldError(errors.password?.message)}
							{...register('password')}
						/>
						{!errors.password && (
							<p className="mt-1 text-xs text-[var(--color-slate)]">
								{t('errors.passwordRule')}
							</p>
						)}
					</div>
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
									{role.name}
								</option>
							))}
						</select>
						{errors.roleCode?.message && (
							<p role="alert" className="mt-1 text-sm text-error">
								{fieldError(errors.roleCode.message)}
							</p>
						)}
						{roles.isError && (
							<p role="alert" className="mt-1 text-sm text-error">
								{t(memberErrorKey(roles.error))}
							</p>
						)}
					</div>
					<p className="text-sm text-[var(--color-slate)]">{t('create.roleNote')}</p>
					<p className="text-xs text-[var(--color-slate)]">{t('create.handover')}</p>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className="btn btn-ghost bg-base-200"
							onClick={backToList}
						>
							{t('create.cancel')}
						</button>
						<Button type="submit" disabled={create.isPending}>
							{create.isPending && (
								<span
									className="loading loading-spinner loading-sm"
									aria-hidden="true"
								/>
							)}
							{create.isPending ? t('create.submitting') : t('create.submit')}
						</Button>
					</div>
				</form>
				<div className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6">
						<h2 className="font-semibold">{t('create.reviewTitle')}</h2>
						<dl className="mt-4 flex flex-col gap-4">
							{review.map(({ label, value }) => (
								<div key={label}>
									<dt className="text-xs text-[var(--color-slate)]">{label}</dt>
									<dd className="mt-1 font-semibold">{value}</dd>
								</div>
							))}
						</dl>
					</section>
					<TipCard
						title={t('create.tipTitle')}
						description={t('create.tipDescription')}
					/>
				</div>
			</div>
			{created && (
				<UserCreatedDialog member={created} company={company} onDone={backToList} />
			)}
		</div>
	);
}
