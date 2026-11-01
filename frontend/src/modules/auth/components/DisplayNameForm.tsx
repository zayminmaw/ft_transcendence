import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, Input } from '@global-components';
import { useUpdateProfile } from '../hooks';

// The API's rule: one line, at most 64 characters after trimming. Empty clears the name. The messages are translation
// keys, translated when shown.
const schema = z.object({
	displayName: z
		.string()
		.trim()
		.max(64, 'profile.tooLong' satisfies ParseKeys<'auth'>)
		.regex(/^\P{Cc}*$/u, 'profile.oneLine' satisfies ParseKeys<'auth'>),
});
type Values = z.infer<typeof schema>;

// Your display name on the profile page. Saving puts the new name in the cached /me, so the card follows at once.
export function DisplayNameForm({ current }: { current: string | null }) {
	const { t } = useTranslation('auth');
	const update = useUpdateProfile();
	const [saved, setSaved] = useState(false);
	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isDirty },
	} = useForm<Values>({
		resolver: zodResolver(schema),
		defaultValues: { displayName: current ?? '' },
	});
	const { onChange, ...field } = register('displayName');

	return (
		<form
			noValidate
			className="flex flex-col gap-3"
			onSubmit={handleSubmit(({ displayName }) =>
				update.mutate(displayName || null, {
					onSuccess: ({ user }) => {
						reset({ displayName: user.displayName ?? '' });
						setSaved(true);
					},
				}),
			)}
		>
			<Input
				label={t('profile.displayName')}
				autoComplete="name"
				error={
					errors.displayName?.message &&
					t(errors.displayName.message as ParseKeys<'auth'>)
				}
				onChange={(event) => {
					setSaved(false);
					return onChange(event);
				}}
				{...field}
			/>
			{!errors.displayName && (
				<p className="-mt-1 text-xs text-[var(--color-slate)]">
					{t('profile.displayNameHint')}
				</p>
			)}
			{update.isError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t('profile.saveFailed')}
				</p>
			)}
			<div className="flex items-center gap-3">
				<Button type="submit" className="w-fit" disabled={!isDirty || update.isPending}>
					{update.isPending ? t('profile.saving') : t('profile.save')}
				</Button>
				<p role="status" className="text-sm text-success">
					{saved ? t('profile.saved') : ''}
				</p>
			</div>
		</form>
	);
}
