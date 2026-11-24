import { useCallback, useState } from 'react';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantQueryKey } from '@utils/query-keys';
import { fileProblem, PDF_TYPE } from '@utils/upload';
import { ApiError, apiRequest } from '@services/api-client';
import { parcelPath, type ParcelDetails, type ProofFile, type ProofKind } from '../api';

// What the server takes: one file of at most 10 MB.
const MAX_BYTES = 10 * 1024 * 1024;

// A refusal's own message (the API words each one), or `fallback` when no answer came or the server failed.
export function refusalMessage(error: unknown, fallback: string) {
	return error instanceof ApiError && error.status < 500 ? error.message : fallback;
}

// Every upload and removal of one parcel's proof, so the page can wait for them before confirming.
const proofMutationKey = (parcelId: string) => tenantQueryKey('parcels', 'proof', parcelId);

export function useProofBusy(parcelId: string) {
	return useIsMutating({ mutationKey: proofMutationKey(parcelId) }) > 0;
}

// One kind of proof of a parcel out for delivery: checking and uploading a file (with how far it has got, 0 to
// 100), replacing the one before, and removing it. The saved file shows in the parcel's cached details at once.
export function useProofFile(parcelId: string, kind: ProofKind, accept: string[]) {
	const queryClient = useQueryClient();
	const [progress, setProgress] = useState(0);
	const [problem, setProblem] = useState<string | null>(null);
	const detailsKey = tenantQueryKey('parcels', 'details', parcelId);
	const refreshProof = useCallback(async () => {
		await queryClient.refetchQueries(
			{ queryKey: tenantQueryKey('parcels', 'details', parcelId), exact: true },
			{ cancelRefetch: false, throwOnError: true },
		);
	}, [queryClient, parcelId]);
	const show = (file: ProofFile | null) =>
		queryClient.setQueryData<ParcelDetails>(
			detailsKey,
			(details) => details && { ...details, proof: { ...details.proof, [kind]: file } },
		);
	// After a refusal the parcel may have moved on: reload it.
	const failed = (error: Error) => {
		setProblem(
			error instanceof ApiError && error.status === 413
				? 'Choose a file of at most 10 MB.'
				: refusalMessage(error, 'Check your connection and try again.'),
		);
		void queryClient.invalidateQueries({ queryKey: detailsKey });
	};
	const path = parcelPath(parcelId, `/proof/${kind}`);

	const upload = useMutation({
		mutationKey: proofMutationKey(parcelId),
		mutationFn: (file: File) => {
			const body = new FormData();
			body.append('file', file);
			setProgress(0);
			return apiRequest<ProofFile>(path, {
				method: 'POST',
				body,
				onUploadProgress: (fraction) => setProgress(Math.round(fraction * 100)),
			});
		},
		onSuccess: show,
		onError: failed,
	});
	const remove = useMutation({
		mutationKey: proofMutationKey(parcelId),
		mutationFn: () => apiRequest<void>(path, { method: 'DELETE' }),
		onSuccess: () => show(null),
		onError: failed,
	});

	return {
		refreshProof,
		// Checked here first, so a wrong file is never sent.
		send: (file: File) => {
			const wrong = fileProblem(file, accept, MAX_BYTES);
			setProblem(
				wrong === 'size'
					? 'Choose a file of at most 10 MB.'
					: wrong === 'type'
						? `Choose a JPEG, PNG or WebP image${accept.includes(PDF_TYPE) ? ', or a PDF' : ''}.`
						: null,
			);
			if (!wrong) upload.mutate(file);
		},
		// The file being sent, for its preview while it goes.
		sending: upload.isPending ? upload.variables : undefined,
		progress,
		remove: () => {
			setProblem(null);
			remove.mutate();
		},
		isRemoving: remove.isPending,
		problem,
	};
}
