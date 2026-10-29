import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, PasswordInput } from '@global-components';
import { ApiError } from '@services/api-client';
import { meetsPasswordRule } from '@utils/password';
import { useChangePassword } from '../hooks';

// The first-login screen asks for the temporary password; the profile page for your current one.
type Mode = 'firstLogin' | 'profile';
const TEXT = {
	firstLogin: {
		current: 'changePassword.temporary',
		currentRequired: 'changePassword.currentRequired',
		submit: 'changePassword.submit',
	},
	profile: {
		current: 'profile.currentPassword',
		currentRequired: 'profile.currentRequired',
		submit: 'profile.changePassword',
	},
} as const satisfies Record<Mode, Record<string, ParseKeys<'auth'>>>;

// The messages are translation keys, translated when shown, so they follow the language switcher.
const schemaFor = (mode: Mode) =>
	z
		.object({
			currentPassword: z.string().min(1, TEXT[mode].currentRequired),
			newPassword: z
				.string()
				.refine(meetsPasswordRule, 'changePassword.rule' satisfies ParseKeys<'auth'>),
			confirmPassword: z.string(),
		})
		.refine((values) => values.confirmPassword === values.newPassword, {
			path: ['confirmPassword'],
			message: 'changePassword.mismatch' satisfies ParseKeys<'auth'>,
		});

type Values = z.infer<ReturnType<typeof schemaFor>>;

// Where each API code shows: under a field, or above the form.
const FIELD_ERRORS = {
	AUTH_WRONG_PASSWORD: ['currentPassword', 'changePassword.wrongCurrent'],
	PASSWORD_RULE: ['newPassword', 'changePassword.rule'],
	PASSWORD_UNCHANGED: ['newPassword', 'changePassword.unchanged'],
} as const;

function formErrorKey(error: unknown) {
	const code = error instanceof ApiError ? error.code : undefined;
	return code === 'AUTH_TOO_MANY_ATTEMPTS' ? 'errors.tooManyAttempts' : 'errors.unknown';
}

// The first-login screen and the profile page. onChanged runs after a change that worked; the fields empty again.
export function ChangePasswordForm({ mode, onChanged }: { mode: Mode; onChanged?: () => void }) {
	const { t } = useTranslation('auth');
	const change = useChangePassword();
	const {
		register,
		handleSubmit,
		setError,
		reset,
		formState: { errors },
	} = useForm<Values>({
		resolver: zodResolver(schemaFor(mode)),
		defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
	});

	const fieldError = (key?: string) => key && t(key as ParseKeys<'auth'>);
	const code = change.error instanceof ApiError ? change.error.code : undefined;
	const showsInForm = !change.isError || !(code && code in FIELD_ERRORS);

	return (
		<form
			noValidate
			className="flex flex-col gap-5"
			onSubmit={handleSubmit(({ currentPassword, newPassword }) =>
				change.mutate(
					{ currentPassword, newPassword },
					{
						onSuccess: () => {
							reset();
							onChanged?.();
						},
						onError: (error) => {
							const known = error instanceof ApiError ? error.code : undefined;
							if (known && known in FIELD_ERRORS) {
								const [field, message] =
									FIELD_ERRORS[known as keyof typeof FIELD_ERRORS];
								setError(field, { message });
							}
						},
					},
				),
			)}
		>
			{change.isError && showsInForm && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(formErrorKey(change.error))}
				</p>
			)}
			<PasswordInput
				label={t(TEXT[mode].current)}
				autoComplete="current-password"
				error={fieldError(errors.currentPassword?.message)}
				{...register('currentPassword')}
			/>
			<div>
				<PasswordInput
					label={t('changePassword.new')}
					autoComplete="new-password"
					error={fieldError(errors.newPassword?.message)}
					{...register('newPassword')}
				/>
				{!errors.newPassword && (
					<p className="mt-1 text-xs text-[var(--color-slate)]">
						{t('changePassword.rule')}
					</p>
				)}
			</div>
			<PasswordInput
				label={t('changePassword.confirm')}
				autoComplete="new-password"
				error={fieldError(errors.confirmPassword?.message)}
				{...register('confirmPassword')}
			/>
			<Button type="submit" className="w-full" disabled={change.isPending}>
				{change.isPending && (
					<span className="loading loading-spinner loading-sm" aria-hidden="true" />
				)}
				{change.isPending ? t('changePassword.submitting') : t(TEXT[mode].submit)}
			</Button>
		</form>
	);
}
