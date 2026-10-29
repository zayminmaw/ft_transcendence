import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, Textarea, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan } from '@modules/auth';
import type { Client } from '../api';
import { CLIENT_FIELD_ERRORS, RATE_TIERS } from '../constants';
import { useClientMutations } from '../hooks/useClientMutations';
import {
	clientSchema,
	type ClientFormOutput,
	type ClientFormValues,
} from '../schemas/clientSchema';
import { toClientValues } from '../utils/clientFormValues';
import { clientErrorKey, errorCode } from '../utils/errors';
import { isRateTier } from '../utils/rateTier';

// The client fields, for adding a client (no `client`) or editing one. Saving opens the client's page.
export function ClientForm({
	client,
	defaultValues,
}: {
	client?: Client;
	defaultValues: ClientFormValues;
}) {
	const { t } = useTranslation('clients');
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { toast } = useToast();
	const can = useCan();
	const withTier = can('clients.view_financials');
	const { createClient, isCreating, createError, updateClient, isUpdating, updateError } =
		useClientMutations();
	const saveError = client ? updateError : createError;
	const isSaving = client ? isUpdating : isCreating;
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors },
	} = useForm<ClientFormValues, unknown, ClientFormOutput>({
		resolver: zodResolver(clientSchema),
		defaultValues,
	});
	const fieldError = (message?: string) => message && t(message as ParseKeys<'clients'>);
	// A tier saved outside the list (the column is free text) stays selectable, so saving doesn't change it.
	const savedTier = defaultValues.rateProfileTier;
	const tierOptions = RATE_TIERS.map((tier) => ({
		value: tier as string,
		label: t(`tiers.${tier}`),
	}));
	if (!isRateTier(savedTier)) tierOptions.push({ value: savedTier, label: savedTier });
	const backTo = client ? companyPath(`clients/${client.id}`) : companyPath('clients');
	// A refusal that belongs to a field shows under it; anything else above the form.
	const fieldFor = (error: unknown) => {
		const code = errorCode(error);
		return code && code in CLIENT_FIELD_ERRORS
			? CLIENT_FIELD_ERRORS[code as keyof typeof CLIENT_FIELD_ERRORS]
			: undefined;
	};
	const formError = saveError && !fieldFor(saveError);

	const onSubmit = handleSubmit((values) => {
		const clientValues = toClientValues(values, withTier);
		const options = {
			onSuccess: (saved: Client) => {
				toast({
					variant: 'success',
					title: client
						? t('form.updated')
						: t('form.created', { name: saved.businessName }),
				});
				navigate(companyPath(`clients/${saved.id}`));
			},
			onError: (error: unknown) => {
				const field = fieldFor(error);
				if (field)
					setError(field, { message: clientErrorKey(error) }, { shouldFocus: true });
			},
		};
		if (client) updateClient({ clientId: client.id, values: clientValues }, options);
		else createClient(clientValues, options);
	});

	return (
		<form
			noValidate
			onSubmit={onSubmit}
			className="flex flex-col gap-8 rounded-box border border-base-300 p-4 md:p-8"
		>
			{formError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(clientErrorKey(saveError))}
				</p>
			)}
			<fieldset className="flex flex-col gap-4">
				<legend className="mb-4 text-lg font-semibold">{t('form.business')}</legend>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Input
						label={t('fields.clientCode')}
						required
						dir="ltr"
						autoComplete="off"
						placeholder="CL-0007"
						error={fieldError(errors.clientCode?.message)}
						{...register('clientCode')}
					/>
					<Input
						label={t('fields.tradeLicenseNo')}
						autoComplete="off"
						error={fieldError(errors.tradeLicenseNo?.message)}
						{...register('tradeLicenseNo')}
					/>
				</div>
				<Input
					label={t('fields.businessName')}
					required
					autoComplete="organization"
					error={fieldError(errors.businessName?.message)}
					{...register('businessName')}
				/>
			</fieldset>

			<fieldset className="flex flex-col gap-4">
				<legend className="mb-4 text-lg font-semibold">{t('form.contact')}</legend>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Input
						label={t('fields.contactPersonName')}
						required
						autoComplete="name"
						error={fieldError(errors.contactPersonName?.message)}
						{...register('contactPersonName')}
					/>
					<Input
						label={t('fields.contactTitle')}
						autoComplete="organization-title"
						error={fieldError(errors.contactTitle?.message)}
						{...register('contactTitle')}
					/>
					<Input
						label={t('fields.mobile1')}
						type="tel"
						required
						dir="ltr"
						autoComplete="tel"
						error={fieldError(errors.mobile1?.message)}
						{...register('mobile1')}
					/>
					<Input
						label={t('fields.mobile2')}
						type="tel"
						dir="ltr"
						autoComplete="off"
						error={fieldError(errors.mobile2?.message)}
						{...register('mobile2')}
					/>
				</div>
				<Input
					label={t('fields.email')}
					type="email"
					required
					dir="ltr"
					autoComplete="email"
					error={fieldError(errors.email?.message)}
					{...register('email')}
				/>
			</fieldset>

			<fieldset className="flex flex-col gap-4">
				<legend className="mb-4 text-lg font-semibold">{t('form.addresses')}</legend>
				<Textarea
					label={t('fields.billingAddress')}
					required
					rows={2}
					error={fieldError(errors.billingAddress?.message)}
					{...register('billingAddress')}
				/>
				<Textarea
					label={t('fields.defaultPickupAddress')}
					required
					rows={2}
					error={fieldError(errors.defaultPickupAddress?.message)}
					{...register('defaultPickupAddress')}
				/>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Input
						label={t('fields.pickupLatitude')}
						inputMode="decimal"
						dir="ltr"
						placeholder="31.95218300"
						error={fieldError(errors.pickupLatitude?.message)}
						{...register('pickupLatitude')}
					/>
					<Input
						label={t('fields.pickupLongitude')}
						inputMode="decimal"
						dir="ltr"
						placeholder="35.92614700"
						error={fieldError(errors.pickupLongitude?.message)}
						{...register('pickupLongitude')}
					/>
				</div>
				<p className="-mt-2 text-xs text-[var(--color-slate)]">
					{t('form.coordinatesNote')}
				</p>
			</fieldset>

			<fieldset className="flex flex-col gap-4">
				<legend className="mb-4 text-lg font-semibold">{t('form.terms')}</legend>
				{withTier && (
					<Select
						label={t('fields.rateProfileTier')}
						options={tierOptions}
						{...register('rateProfileTier')}
					/>
				)}
				<Textarea
					label={t('fields.operationalNotes')}
					error={fieldError(errors.operationalNotes?.message)}
					{...register('operationalNotes')}
				/>
			</fieldset>

			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					className="btn btn-ghost bg-base-200"
					onClick={() => navigate(backTo)}
				>
					{t('form.cancel')}
				</button>
				<Button type="submit" disabled={isSaving}>
					{isSaving && (
						<span className="loading loading-spinner loading-sm" aria-hidden="true" />
					)}
					{client ? t('form.save') : t('form.submit')}
				</Button>
			</div>
		</form>
	);
}
