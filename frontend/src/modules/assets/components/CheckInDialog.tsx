import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Select, Textarea, useToast } from '@global-components';
import type { Asset, AssetCondition, AssetHolder } from '../api';
import { RETURN_CONDITIONS } from '../constants';
import { useAssetMutations } from '../hooks/useAssetMutations';
import { assetErrorKey } from '../utils/errors';

// Takes an asset back from its driver into the depot, with the condition it came back in (assets.assign). Mounted
// only while open.
export function CheckInDialog({
	asset,
	holder,
	onClose,
}: {
	asset: Asset;
	holder: AssetHolder;
	onClose: () => void;
}) {
	const { t } = useTranslation('assets');
	const { toast } = useToast();
	const { checkInAsset, isCheckingIn, checkInError } = useAssetMutations();
	const [condition, setCondition] = useState<AssetCondition>(
		asset.currentCondition === 'needs_maintenance' ? 'needs_maintenance' : 'good',
	);
	const [notes, setNotes] = useState('');

	return (
		<Dialog
			open
			onClose={onClose}
			title={t('checkIn.title', { name: asset.assetName })}
			description={t('checkIn.description', { driver: holder.driverName })}
			onSubmit={(event) => {
				event.preventDefault();
				checkInAsset(
					{ assetId: asset.id, values: { condition, notes: notes.trim() || null } },
					{
						onSuccess: () => {
							onClose();
							toast({
								variant: 'success',
								title: t('checkIn.done', { name: asset.assetName }),
							});
						},
					},
				);
			}}
			actions={
				<>
					<button type="button" className="btn border-0 bg-base-200" onClick={onClose}>
						{t('form.cancel')}
					</button>
					<button type="submit" className="btn btn-neutral" disabled={isCheckingIn}>
						{t('checkIn.submit')}
					</button>
				</>
			}
		>
			<Select
				label={t('checkIn.condition')}
				value={condition}
				onChange={(event) => setCondition(event.target.value as AssetCondition)}
				options={RETURN_CONDITIONS.map((value) => ({
					value,
					label: t(`condition.${value}`),
				}))}
			/>
			<Textarea
				label={t('checkIn.notes')}
				rows={2}
				maxLength={2000}
				placeholder={t('checkIn.notesPlaceholder')}
				value={notes}
				onChange={(event) => setNotes(event.target.value)}
			/>
			{checkInError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(assetErrorKey(checkInError))}
				</p>
			)}
		</Dialog>
	);
}
