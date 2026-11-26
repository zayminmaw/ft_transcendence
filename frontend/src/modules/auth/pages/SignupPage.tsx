import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { Button, Input, LanguageSwitcher, PasswordInput } from '@global-components';
import { useAuth } from '@hooks/useAuth';
import { useSessionCheck } from '@hooks/useSessionCheck';
import { ApiError, errorKey, fromErrorCode } from '@services/api-client';
import { ACCOUNT_EMAIL_PATTERN, EMAIL_MAX_LENGTH } from '@utils/form-rules';
import { formatDate } from '@utils/format';
import { meetsPasswordRule } from '@utils/password';
import type { InvitePreview } from '../api';
import { LegalLinks } from '../components/LegalLinks';
import { LoadingScreen } from '../components/LoadingScreen';
import { useInvitePreview, useLogout, useRoleName, useSignup } from '../hooks';
import { inviteTokenFromHash } from '../invite-link';

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;
const DISPLAY_NAME_PATTERN = /^[^\p{Cc}\u2028\u2029]{0,64}$/u;

const ERROR_MESSAGES = {
	INVITE_INVALID: 'signup.errors.invalidInvite',
	INVITE_EMAIL_MISMATCH: 'signup.errors.emailMismatch',
	INVALID_USERNAME: 'signup.errors.invalidUsername',
	INVALID_EMAIL: 'signup.errors.invalidEmail',
	PASSWORD_RULE: 'signup.errors.passwordRule',
	SIGNUP_TAKEN: 'signup.errors.taken',
	AUTH_TOO_MANY_ATTEMPTS: 'errors.tooManyAttempts',
} as const satisfies Record<string, ParseKeys<'auth'>>;

const FIELD_CODES = {
	INVALID_USERNAME: 'username',
	INVALID_EMAIL: 'email',
	INVITE_EMAIL_MISMATCH: 'email',
	PASSWORD_RULE: 'password',
} as const;

type FormValues = {
	email: string;
	username: string;
	displayName: string;
	password: string;
	confirmPassword: string;
};

function makeSchema(boundEmail: string | null) {
	return z
		.object({
			email: boundEmail
				? z.string()
				: z
						.string()
						.trim()
						.max(
							EMAIL_MAX_LENGTH,
							'signup.errors.invalidEmail' satisfies ParseKeys<'auth'>,
						)
						.regex(
							ACCOUNT_EMAIL_PATTERN,
							'signup.errors.invalidEmail' satisfies ParseKeys<'auth'>,
						),
			username: z
				.string()
				.trim()
				.regex(
					USERNAME_PATTERN,
					'signup.errors.invalidUsername' satisfies ParseKeys<'auth'>,
				),
			displayName: z
				.string()
				.trim()
				.max(64, 'profile.tooLong' satisfies ParseKeys<'auth'>)
				.regex(DISPLAY_NAME_PATTERN, 'profile.oneLine' satisfies ParseKeys<'auth'>),
			password: z
				.string()
				.refine(
					meetsPasswordRule,
					'signup.errors.passwordRule' satisfies ParseKeys<'auth'>,
				),
			confirmPassword: z.string(),
		})
		.refine((values) => values.password === values.confirmPassword, {
			path: ['confirmPassword'],
			message: 'changePassword.mismatch' satisfies ParseKeys<'auth'>,
		});
}

function SignupForm({ token, preview }: { token: string; preview: InvitePreview }) {
	const { t, i18n } = useTranslation('auth');
	const roleName = useRoleName();
	const signup = useSignup();
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(makeSchema(preview.email)),
		defaultValues: {
			email: preview.email ?? '',
			username: '',
			displayName: '',
			password: '',
			confirmPassword: '',
		},
	});

	const fieldError = (key?: string) => key && t(key as ParseKeys<'auth'>);
	const formError = signup.isError && !fromErrorCode(FIELD_CODES, signup.error);

	const onSubmit = handleSubmit((values) => {
		signup.mutate(
			{
				token,
				username: values.username.trim(),
				email: preview.email ?? values.email.trim(),
				displayName: values.displayName.trim() || null,
				password: values.password,
			},
			{
				onError: (error) => {
					const field = fromErrorCode(FIELD_CODES, error);
					if (field) setError(field, { message: errorKey(ERROR_MESSAGES, error) });
				},
			},
		);
	});

	return (
		<>
			<div className="rounded-box border border-base-300 bg-base-200 p-4 text-sm">
				<p className="font-semibold">{preview.organization.name}</p>
				<p className="mt-1 text-xs text-[var(--color-slate)]">
					{t('signup.inviteSummary', {
						role: roleName(preview.role),
						date: formatDate(preview.expiresAt, i18n.language, { dateStyle: 'medium' }),
					})}
				</p>
			</div>
			<form noValidate className="flex flex-col gap-4" onSubmit={onSubmit}>
				{formError && (
					<p role="alert" className="alert alert-error alert-soft text-sm">
						{t(errorKey(ERROR_MESSAGES, signup.error))}
					</p>
				)}
				<div>
					<Input
						label={t('signup.email')}
						type="email"
						required
						readOnly={Boolean(preview.email)}
						autoComplete="email"
						spellCheck={false}
						dir="ltr"
						error={fieldError(errors.email?.message)}
						{...register('email')}
					/>
					{preview.email && (
						<p className="mt-1 text-xs text-[var(--color-slate)]">
							{t('signup.emailLocked')}
						</p>
					)}
				</div>
				<Input
					label={t('signup.username')}
					required
					autoComplete="username"
					autoCapitalize="none"
					spellCheck={false}
					dir="ltr"
					error={fieldError(errors.username?.message)}
					{...register('username')}
				/>
				<Input
					label={t('signup.displayName')}
					autoComplete="name"
					error={fieldError(errors.displayName?.message)}
					{...register('displayName')}
				/>
				<div>
					<PasswordInput
						label={t('signup.password')}
						required
						autoComplete="new-password"
						error={fieldError(errors.password?.message)}
						{...register('password')}
					/>
					{!errors.password && (
						<p className="mt-1 text-xs text-[var(--color-slate)]">
							{t('changePassword.rule')}
						</p>
					)}
				</div>
				<PasswordInput
					label={t('signup.confirmPassword')}
					required
					autoComplete="new-password"
					error={fieldError(errors.confirmPassword?.message)}
					{...register('confirmPassword')}
				/>
				<Button type="submit" className="mt-2 w-full" disabled={signup.isPending}>
					{signup.isPending && (
						<span className="loading loading-spinner loading-sm" aria-hidden="true" />
					)}
					{signup.isPending ? t('signup.submitting') : t('signup.submit')}
				</Button>
			</form>
		</>
	);
}

export function SignupPage() {
	const { t } = useTranslation('auth');
	const { accessToken } = useAuth();
	const { checking } = useSessionCheck();
	const logout = useLogout();
	const token = inviteTokenFromHash(useLocation().hash);
	const invite = useInvitePreview(accessToken ? '' : token);

	useEffect(() => {
		document.title = `${t('signup.title')} — Transcend`;
	}, [t]);

	if (checking) return <LoadingScreen />;
	if (accessToken && !token) return <Navigate to="/app" replace />;

	const inviteNotFound =
		!token ||
		(invite.isError && invite.error instanceof ApiError && invite.error.status === 404);

	return (
		<div className="grid min-h-dvh bg-base-100 text-base-content md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
			<aside className="hidden flex-col justify-between bg-neutral p-14 text-neutral-content md:flex">
				<Link to="/" className="workspace-title w-fit text-[2rem]">
					transcend
				</Link>
				<div>
					<p className="workspace-title text-5xl lg:text-6xl">{t('signup.panelTitle')}</p>
					<p className="mt-8 max-w-md text-sm leading-relaxed">{t('signup.panelText')}</p>
					<div className="mt-8 border-t border-white/20 pt-8">
						<p className="font-medium text-primary">{t('signup.panelAccessTitle')}</p>
						<p className="mt-3 max-w-md text-sm leading-relaxed">
							{t('signup.panelAccessText')}
						</p>
					</div>
				</div>
				<p className="text-xs">{t('login.panelFooter')}</p>
			</aside>
			<div className="flex flex-col px-4 py-6 sm:px-6 md:px-10">
				<div className="flex items-center justify-between gap-4 md:justify-end">
					<Link to="/" className="workspace-title text-[2rem] md:hidden">
						transcend
					</Link>
					<LanguageSwitcher />
				</div>
				<main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 py-10">
					<div>
						<h1 className="workspace-title text-[2.25rem]">{t('signup.title')}</h1>
						<p className="mt-2 text-sm text-[var(--color-slate)]">
							{t('signup.intro')}
						</p>
					</div>

					{accessToken ? (
						<div className="flex flex-col gap-4 rounded-box border border-base-300 bg-base-200 p-5 text-sm">
							<p>{t('signup.alreadySignedIn')}</p>
							<div className="flex flex-wrap gap-3">
								<Button
									type="button"
									disabled={logout.isPending}
									onClick={() => logout.mutate()}
								>
									{t('account.logOut')}
								</Button>
								<Link to="/app" className="btn btn-ghost bg-base-100">
									{t('signup.openWorkspace')}
								</Link>
							</div>
						</div>
					) : inviteNotFound ? (
						<div className="flex flex-col gap-4">
							<p role="alert" className="alert alert-error alert-soft text-sm">
								{t('signup.errors.invalidInvite')}
							</p>
							<p className="text-sm text-[var(--color-slate)]">
								{t('signup.invalidHint')}
							</p>
							<Link to="/login" className="btn w-fit">
								{t('signup.goToLogin')}
							</Link>
						</div>
					) : invite.isPending ? (
						<p className="flex items-center gap-2 text-sm text-[var(--color-slate)]">
							<span
								className="loading loading-spinner loading-sm"
								aria-hidden="true"
							/>
							{t('signup.checkingInvite')}
						</p>
					) : invite.isError ? (
						<div className="flex flex-col gap-4">
							<p role="alert" className="alert alert-error alert-soft text-sm">
								{t(errorKey(ERROR_MESSAGES, invite.error))}
							</p>
							<Button
								type="button"
								className="w-fit"
								onClick={() => void invite.refetch()}
							>
								{t('picker.retry')}
							</Button>
						</div>
					) : (
						<SignupForm token={token} preview={invite.data} />
					)}

					<p className="text-sm text-[var(--color-slate)]">
						{t('signup.haveAccount')}{' '}
						<Link to="/login" className="link link-hover font-medium text-base-content">
							{t('login.title')}
						</Link>
					</p>
					<LegalLinks />
				</main>
			</div>
		</div>
	);
}
