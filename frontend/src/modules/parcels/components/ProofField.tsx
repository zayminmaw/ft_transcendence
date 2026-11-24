import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatFileSize } from '@utils/format';
import type { ProofFile, ProofKind } from '../api';
import { useProofFile } from '../hooks/useProofFile';
import { ProofPreview } from './ProofPreview';

// One file of a proof of delivery: chosen (or drawn, through `picker`), checked here, uploaded at once with its
// progress, then shown with Replace and Remove. The server checks the same rules again.
export function ProofField({
	parcelId,
	kind,
	label,
	hint,
	required = false,
	accept,
	capture,
	saved,
	picker,
}: {
	parcelId: string;
	kind: ProofKind;
	label: string;
	// Under the file chooser; a `picker` brings its own.
	hint?: string;
	required?: boolean;
	accept: string[];
	// Opens the camera on a phone.
	capture?: 'environment';
	saved: ProofFile | null;
	// In place of the file chooser, e.g. the signature pad. It calls `send` with the file to upload.
	picker?: (send: (file: File) => void, disabled: boolean) => ReactNode;
}) {
	const inputId = useId();
	const { t, i18n } = useTranslation('parcels');
	const proof = useProofFile(parcelId, kind, accept);
	const busy = Boolean(proof.sending) || proof.isRemoving;
	const problemId = `${inputId}-problem`;

	const chooser = (text: string) => (
		<label className="btn btn-sm border-0 bg-base-200">
			{text}
			<input
				id={inputId}
				type="file"
				className="sr-only"
				accept={accept.join(',')}
				capture={capture}
				disabled={busy}
				aria-describedby={proof.problem ? problemId : undefined}
				onChange={(event) => {
					const file = event.target.files?.[0];
					// Choosing the same file again must still fire a change.
					event.target.value = '';
					if (file) proof.send(file);
				}}
			/>
		</label>
	);

	return (
		<fieldset className="flex flex-col gap-2" aria-busy={busy}>
			<legend className="mb-2 text-sm font-medium">
				{label}
				{required && ' *'}
			</legend>

			{proof.sending ? (
				<div className="flex flex-col gap-2">
					<ProofPreview label={label} local={proof.sending} />
					<progress
						className="progress progress-primary w-full"
						value={proof.progress}
						max={100}
						aria-label={t('proof.uploadingLabel', { label })}
					/>
					<p role="status" className="text-sm text-[var(--color-slate)]">
						Uploading {proof.sending.name} · {proof.progress}%
					</p>
				</div>
			) : saved ? (
				<div className="flex flex-col gap-2">
					<ProofPreview label={label} saved={saved} onRefresh={proof.refreshProof} />
					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="min-w-0 truncate text-sm text-[var(--color-slate)]">
							{saved.name} · {formatFileSize(saved.sizeBytes, i18n.language)}
						</p>
						<div className="flex gap-2">
							{!picker && chooser(t('proof.replace'))}
							<button
								type="button"
								className="btn btn-ghost btn-sm"
								disabled={busy}
								onClick={proof.remove}
							>
								{proof.isRemoving ? 'Removing…' : 'Remove'}
							</button>
						</div>
					</div>
				</div>
			) : picker ? (
				picker(proof.send, busy)
			) : (
				<div className="flex flex-wrap items-center gap-3 rounded-box border border-dashed border-base-300 p-4">
					{chooser(t('proof.choose'))}
					<p className="text-sm text-[var(--color-slate)]">{hint}</p>
				</div>
			)}

			{proof.problem && (
				<p id={problemId} role="alert" className="text-sm text-error">
					{proof.problem}
				</p>
			)}
		</fieldset>
	);
}
