import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Button, Input, LanguageSwitcher, PasswordInput } from '@global-components';
import { useAuth } from '@hooks/useAuth';
import { useSessionCheck } from '@hooks/useSessionCheck';
import { ApiError } from '@services/api-client';
import type { SessionEnd } from '@app/store/session';
import { LoadingScreen } from '../components/LoadingScreen';
import { useLogin } from '../hooks';
import type { LoginValues } from '../api';

// Error codes from the API, shown in the visitor's language. Anything else gets the general message.
const ERROR_MESSAGES = {
	AUTH_INVALID_CREDENTIALS: 'errors.invalidCredentials',
	AUTH_TOO_MANY_ATTEMPTS: 'errors.tooManyAttempts',
} as const;

// Why a 42 login came back here: the API redirects to /login?oauth=<reason>.
const OAUTH_MESSAGES = {
	denied: 'errors.oauthDenied',
	failed: 'errors.oauthFailed',
	no_account: 'errors.oauthNoAccount',
	unavailable: 'errors.oauthUnavailable',
} as const;

// The API checks the details; the form only makes sure neither field is empty. Its messages are translation keys,
// translated when shown, so they follow the language switcher.
const loginSchema = z.object({
	login: z
		.string()
		.trim()
		.min(1, 'login.loginRequired' satisfies ParseKeys<'auth'>)
		// The API takes plain ASCII only, so look-alike letters can't dodge its per-name limit.
		.regex(/^[\x21-\x7E]+$/, 'login.loginAscii' satisfies ParseKeys<'auth'>),
	password: z.string().min(1, 'login.passwordRequired' satisfies ParseKeys<'auth'>),
});

function errorMessageKey(error: unknown) {
	// A login name the API's format check refuses can't belong to an account either.
	if (error instanceof ApiError && error.status === 400) return 'errors.invalidCredentials';
	const code = error instanceof ApiError ? error.code : undefined;
	return code && code in ERROR_MESSAGES
		? ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES]
		: 'errors.unknown';
}

export function LoginPage() {
	const { t } = useTranslation('auth');
	const { accessToken } = useAuth();
	const { checking } = useSessionCheck();
	const { state } = useLocation();
	const [searchParams] = useSearchParams();
	const login = useLogin();
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: { login: '', password: '' },
	});

	useEffect(() => {
		document.title = `${t('login.title')} — Transcend`;
	}, [t]);

	const fieldError = (key?: string) => key && t(key as ParseKeys<'auth'>);

	if (checking) return <LoadingScreen />;
	if (accessToken) return <Navigate to="/app" replace />;
	const ended = (state as { ended?: SessionEnd } | null)?.ended;
	const oauth = searchParams.get('oauth');
	const oauthMessage =
		oauth && oauth in OAUTH_MESSAGES
			? OAUTH_MESSAGES[oauth as keyof typeof OAUTH_MESSAGES]
			: undefined;

	return (
		<div className="grid min-h-dvh bg-base-100 text-base-content md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
			<aside className="hidden flex-col justify-between bg-neutral p-14 text-neutral-content md:flex">
				<Link to="/" className="workspace-title w-fit text-[2rem]">
					transcend
				</Link>
				<div>
					<p className="workspace-title text-5xl lg:text-6xl">{t('login.panelTitle')}</p>
					<p className="mt-8 max-w-md text-sm leading-relaxed">{t('login.panelText')}</p>
					<div className="mt-8 border-t border-white/20 pt-8">
						<p className="font-medium text-primary">{t('login.panelAccessTitle')}</p>
						<p className="mt-3 max-w-md text-sm leading-relaxed">
							{t('login.panelAccessText')}
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
				<main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-10">
					<div>
						<h1 className="workspace-title text-[2.25rem]">{t('login.title')}</h1>
						<p className="mt-2 text-sm text-[var(--color-slate)]">{t('login.intro')}</p>
					</div>
					{ended === 'expired' && !login.isError && (
						<p role="status" className="alert alert-info alert-soft text-sm">
							{t('errors.sessionExpired')}
						</p>
					)}
					<form
						noValidate
						className="flex flex-col gap-5"
						onSubmit={handleSubmit((values) => login.mutate(values))}
					>
						{login.isError && (
							<p role="alert" className="alert alert-error alert-soft text-sm">
								{t(errorMessageKey(login.error))}
							</p>
						)}
						{oauthMessage && !login.isError && (
							<p role="alert" className="alert alert-error alert-soft text-sm">
								{t(oauthMessage)}
							</p>
						)}
						<Input
							label={t('login.login')}
							autoComplete="username"
							autoCapitalize="none"
							spellCheck={false}
							error={fieldError(errors.login?.message)}
							{...register('login')}
						/>
						<PasswordInput
							label={t('login.password')}
							autoComplete="current-password"
							error={fieldError(errors.password?.message)}
							{...register('password')}
						/>
						<Button type="submit" className="w-full" disabled={login.isPending}>
							{login.isPending && (
								<span
									className="loading loading-spinner loading-sm"
									aria-hidden="true"
								/>
							)}
							{login.isPending ? t('login.submitting') : t('login.submit')}
						</Button>
					</form>
					<div className="-mt-3 flex flex-col gap-3">
						<p className="divider my-0 text-xs text-[var(--color-slate)]">
							{t('login.or')}
						</p>
						{/* A full-page navigation: the API sends the browser to 42 and back to /app. */}
						<a
							href="/api/auth/42"
							className="btn w-full border-base-300 bg-base-100 hover:bg-base-200"
						>
							{t('login.with42')}
						</a>
					</div>
					<div className="text-sm">
						<h2 className="font-semibold">{t('login.helpTitle')}</h2>
						<p className="mt-2 text-[var(--color-slate)]">{t('login.help')}</p>
						<Link to="/" className="link link-hover mt-6 inline-block">
							{t('login.backToWebsite')}
						</Link>
					</div>
				</main>
			</div>
		</div>
	);
}
