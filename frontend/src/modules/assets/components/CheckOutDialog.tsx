import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Select, Textarea, useToast } from '@global-components';
import { useDriverChoices } from '@modules/drivers';
import type { Asset } from '../api';
import { useAssetMutations } from '../hooks/useAssetMutations';
import { assetErrorKey } from '../utils/errors';

// Hands an asset in the depot to a driver (assets.assign). Mounted only while open.
export function CheckOutDialog({ asset, onClose }: { asset: Asset; onClose: () => void }) {
	const { t } = useTranslation('assets');
	const { toast } = useToast();
	const { driverChoices, isChoicesPending, isChoicesError } = useDriverChoices();
	const { checkOutAsset, isCheckingOut, checkOutError } = useAssetMutations();
	const [driverId, setDriverId] = useState('');
	const [notes, setNotes] = useState('');
	const driver = driverChoices.find((choice) => choice.id === driverId);

	return (
		<Dialog
			open
			onClose={onClose}
			title={t('checkOut.title', { name: asset.assetName })}
			description={t('checkOut.description')}
			onSubmit={(event) => {
				event.preventDefault();
				if (!driver) return;
				checkOutAsset(
					{
						assetId: asset.id,
						values: { driverId: driver.id, notes: notes.trim() || null },
						driverName: driver.name,
					},
					{
						onSuccess: () => {
							onClose();
							toast({
								variant: 'success',
								title: t('checkOut.done', {
									name: asset.assetName,
									driver: driver.name,
								}),
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
					<button
						type="submit"
						className="btn btn-neutral"
						disabled={isCheckingOut || !driver}
					>
						{t('checkOut.submit')}
					</button>
				</>
			}
		>
			{driverChoices.length > 0 || isChoicesPending ? (
				<Select
					label={t('checkOut.driver')}
					required
					value={driverId}
					onChange={(event) => setDriverId(event.target.value)}
					disabled={isChoicesPending}
					options={[
						{ value: '', label: t('checkOut.driverPlaceholder') },
						...driverChoices.map((choice) => ({
							value: choice.id,
							label: `${choice.name} · ${choice.employeeCode}`,
						})),
					]}
				/>
			) : (
				<p className="text-sm text-[var(--color-slate)]">
					{isChoicesError ? t('errors.unknown') : t('checkOut.noDrivers')}
				</p>
			)}
			<Textarea
				label={t('checkOut.notes')}
				rows={2}
				maxLength={2000}
				placeholder={t('checkOut.notesPlaceholder')}
				value={notes}
				onChange={(event) => setNotes(event.target.value)}
			/>
			{checkOutError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(assetErrorKey(checkOutError))}
				</p>
			)}
		</Dialog>
	);
}
