import { type ChangeEvent, useId, useState } from 'react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@services/api-client';
import { fileProblem, IMAGE_TYPES } from '@utils/upload';
import { useRemoveAvatar, useUploadAvatar } from '../hooks';

// The API's rule: one JPEG, PNG or WebP image of at most 2 MB.
const MAX_BYTES = 2 * 1024 * 1024;

type Message = ParseKeys<'auth'>;

// Change or remove your picture on the profile page. A chosen file is uploaded at once; the answer goes into the
// cached /me, so the sidebar card and profile header show it straight away.
export function AvatarForm({ hasPicture }: { hasPicture: boolean }) {
	const { t } = useTranslation('auth');
	const inputId = useId();
	const hintId = `${inputId}-hint`;
	const errorId = `${inputId}-error`;
	const upload = useUploadAvatar();
	const remove = useRemoveAvatar();
	const [error, setError] = useState<Message | null>(null);
	const [done, setDone] = useState<Message | null>(null);
	const busy = upload.isPending || remove.isPending;

	const failed = (cause: unknown) => {
		if (cause instanceof ApiError && cause.status === 413) setError('profile.pictureTooLarge');
		else if (cause instanceof ApiError && cause.status === 400)
			setError('profile.pictureWrongType');
		else setError('profile.pictureFailed');
	};

	const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		// Choosing the same file again must still fire a change.
		event.target.value = '';
		setDone(null);
		if (!file) return;
		const problem = fileProblem(file, IMAGE_TYPES, MAX_BYTES);
		if (problem)
			return setError(
				problem === 'type' ? 'profile.pictureWrongType' : 'profile.pictureTooLarge',
			);
		setError(null);
		upload.mutate(file, { onSuccess: () => setDone('profile.pictureSaved'), onError: failed });
	};

	const onRemove = () => {
		setError(null);
		setDone(null);
		remove.mutate(undefined, {
			onSuccess: () => setDone('profile.pictureRemoved'),
			onError: failed,
		});
	};

	return (
		<div className="flex flex-col gap-2" aria-busy={busy}>
			<div className="flex flex-wrap items-center gap-2">
				<label
					htmlFor={inputId}
					className={`btn btn-sm border-0 bg-base-200 ${busy ? 'btn-disabled' : ''}`}
				>
					{upload.isPending && (
						<span className="loading loading-spinner loading-xs" aria-hidden="true" />
					)}
					{upload.isPending ? t('profile.pictureUploading') : t('profile.pictureChange')}
					<input
						id={inputId}
						type="file"
						accept={IMAGE_TYPES.join(',')}
						disabled={busy}
						aria-describedby={error ? errorId : hintId}
						className="sr-only"
						onChange={onChoose}
					/>
				</label>
				{hasPicture && (
					<button
						type="button"
						className="btn btn-ghost btn-sm"
						disabled={busy}
						onClick={onRemove}
					>
						{remove.isPending
							? t('profile.pictureRemoving')
							: t('profile.pictureRemove')}
					</button>
				)}
			</div>
			{error ? (
				<p id={errorId} role="alert" className="text-xs text-error">
					{t(error)}
				</p>
			) : (
				<p id={hintId} className="text-xs text-[var(--color-slate)]">
					{t('profile.pictureHint')}
				</p>
			)}
			<p role="status" className="min-h-4 text-xs text-success">
				{done ? t(done) : ''}
			</p>
		</div>
	);
}
