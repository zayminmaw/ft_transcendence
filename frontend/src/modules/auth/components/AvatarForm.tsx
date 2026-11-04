import { type ChangeEvent, useRef, useState } from 'react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@services/api-client';
import { useRemoveAvatar, useUploadAvatar } from '../hooks';

// The API's rule: one JPEG, PNG or WebP image of at most 2 MB. Checked here first, so a wrong file is never sent.
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

type Message = ParseKeys<'auth'>;

// Change or remove your picture on the profile page. A chosen file is uploaded at once; the answer goes into the
// cached /me, so the header and the card show it straight away.
export function AvatarForm({ hasPicture }: { hasPicture: boolean }) {
	const { t } = useTranslation('auth');
	const upload = useUploadAvatar();
	const remove = useRemoveAvatar();
	const input = useRef<HTMLInputElement>(null);
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
		if (!TYPES.includes(file.type)) return setError('profile.pictureWrongType');
		if (file.size > MAX_BYTES) return setError('profile.pictureTooLarge');
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
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					className="btn btn-sm bg-base-100"
					disabled={busy}
					onClick={() => input.current?.click()}
				>
					{upload.isPending ? t('profile.pictureUploading') : t('profile.pictureChange')}
				</button>
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
				<input
					ref={input}
					type="file"
					accept={TYPES.join(',')}
					className="hidden"
					tabIndex={-1}
					aria-hidden="true"
					onChange={onChoose}
				/>
			</div>
			{error ? (
				<p role="alert" className="text-xs text-error">
					{t(error)}
				</p>
			) : (
				<p className="text-xs text-[var(--color-slate)]">{t('profile.pictureHint')}</p>
			)}
			<p role="status" className="text-xs text-success">
				{done ? t(done) : ''}
			</p>
		</div>
	);
}
