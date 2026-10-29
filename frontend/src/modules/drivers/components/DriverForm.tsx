import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, Textarea, useToast } from '@global-components';
import { useCompanyPath } from '@hooks/useCompanyPath';
import { useCan } from '@modules/auth';
import type { Driver } from '../api';
import {
	COMPENSATION_TYPES,
	DRIVER_CATEGORIES,
	EMPLOYMENT_CLASSIFICATIONS,
	EMPLOYMENT_STATUSES,
	FLEET_ARRANGEMENTS,
} from '../constants';
import { useDriverMutations } from '../hooks/useDriverMutations';
import {
	driverSchema,
	type DriverFormOutput,
	type DriverFormValues,
} from '../schemas/driverSchema';
import { toDriverValues } from '../utils/driverFormValues';
import { driverErrorField, driverErrorKey } from '../utils/errors';

// The driver fields, for onboarding a driver (no `driver`) or editing one (drivers.manage). Saving opens the
// driver's page. Payroll fields show only with staff.view_payroll.
export function DriverForm({
	driver,
	defaultValues,
}: {
	driver?: Driver;
	defaultValues: DriverFormValues;
}) {
	const { t } = useTranslation('drivers');
	const navigate = useNavigate();
	const companyPath = useCompanyPath();
	const { toast } = useToast();
	const can = useCan();
	const withPayroll = can('staff.view_payroll');
	const { createDriver, isCreating, createError, updateDriver, isUpdating, updateError } =
		useDriverMutations();
	const saveError = driver ? updateError : createError;
	const isSaving = driver ? isUpdating : isCreating;
	const {
		register,
		handleSubmit,
		setError,
		control,
		formState: { errors },
	} = useForm<DriverFormValues, unknown, DriverFormOutput>({
		resolver: zodResolver(driverSchema),
		defaultValues,
	});
	const employmentStatus = useWatch({ control, name: 'employmentStatus' });
	const fieldError = (message?: string) => message && t(message as ParseKeys<'drivers'>);
	const backTo = driver ? companyPath(`drivers/${driver.id}`) : companyPath('drivers');
	const formError = saveError && !driverErrorField(saveError);
	const options = <T extends string>(
		values: readonly T[],
		group: 'category' | 'fleet' | 'classification' | 'compensation' | 'employmentStatus',
	) => values.map((value) => ({ value, label: t(`${group}.${value}` as ParseKeys<'drivers'>) }));

	const onSubmit = handleSubmit((values) => {
		const driverValues = toDriverValues(values, withPayroll);
		const handlers = {
			onSuccess: (saved: Driver) => {
				toast({
					variant: 'success',
					title: driver
						? t('form.updated')
						: t('form.created', { name: `${saved.firstName} ${saved.lastName}` }),
				});
				navigate(companyPath(`drivers/${saved.id}`));
			},
			onError: (error: unknown) => {
				const field = driverErrorField(error);
				if (field)
					setError(field, { message: driverErrorKey(error) }, { shouldFocus: true });
			},
		};
		if (driver) updateDriver({ driverId: driver.id, values: driverValues }, handlers);
		else createDriver(driverValues, handlers);
	});

	return (
		<form
			noValidate
			onSubmit={onSubmit}
			className="flex flex-col gap-8 rounded-box border border-base-300 p-4 md:p-8"
		>
			{formError && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(driverErrorKey(saveError))}
				</p>
			)}

			<fieldset className="flex flex-col gap-4">
				<legend className="mb-4 text-lg font-semibold">{t('form.personal')}</legend>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Input
						label={t('fields.firstName')}
						required
						autoComplete="off"
						error={fieldError(errors.firstName?.message)}
						{...register('firstName')}
					/>
					<Input
						label={t('fields.lastName')}
						required
						autoComplete="off"
						error={fieldError(errors.lastName?.message)}
						{...register('lastName')}
					/>
					<Input
						label={t('fields.nationalId')}
						required
						dir="ltr"
						autoComplete="off"
						error={fieldError(errors.nationalId?.message)}
						{...register('nationalId')}
					/>
					<Input
						label={t('fields.dateOfBirth')}
						type="date"
						required
						error={fieldError(errors.dateOfBirth?.message)}
						{...register('dateOfBirth')}
					/>
					<Input
						label={t('fields.personalMobile')}
						type="tel"
						required
						dir="ltr"
						autoComplete="off"
						error={fieldError(errors.personalMobile?.message)}
						{...register('personalMobile')}
					/>
					<Input
						label={t('fields.personalEmail')}
						type="email"
						required
						dir="ltr"
						autoComplete="off"
						error={fieldError(errors.personalEmail?.message)}
						{...register('personalEmail')}
					/>
				</div>
				<Textarea
					label={t('fields.residentialAddress')}
					required
					rows={2}
					error={fieldError(errors.residentialAddress?.message)}
					{...register('residentialAddress')}
				/>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Input
						label={t('fields.emergencyContactName')}
						required
						autoComplete="off"
						error={fieldError(errors.emergencyContactName?.message)}
						{...register('emergencyContactName')}
					/>
					<Input
						label={t('fields.emergencyContactPhone')}
						type="tel"
						required
						dir="ltr"
						autoComplete="off"
						error={fieldError(errors.emergencyContactPhone?.message)}
						{...register('emergencyContactPhone')}
					/>
				</div>
			</fieldset>

			<fieldset className="flex flex-col gap-4">
				<legend className="mb-4 text-lg font-semibold">{t('form.employment')}</legend>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Input
						label={t('fields.employeeCode')}
						required
						dir="ltr"
						autoComplete="off"
						placeholder="DRV-006"
						error={fieldError(errors.employeeCode?.message)}
						{...register('employeeCode')}
					/>
					<Input
						label={t('fields.hireDate')}
						type="date"
						required
						error={fieldError(errors.hireDate?.message)}
						{...register('hireDate')}
					/>
					<Select
						label={t('fields.employmentClassification')}
						options={options(EMPLOYMENT_CLASSIFICATIONS, 'classification')}
						{...register('employmentClassification')}
					/>
					<Select
						label={t('fields.compensationType')}
						options={options(COMPENSATION_TYPES, 'compensation')}
						{...register('compensationType')}
					/>
					{driver && (
						<Select
							label={t('fields.employmentStatus')}
							options={options(EMPLOYMENT_STATUSES, 'employmentStatus')}
							{...register('employmentStatus')}
						/>
					)}
					{employmentStatus === 'terminated' && (
						<Input
							label={t('fields.terminationDate')}
							type="date"
							required
							error={fieldError(errors.terminationDate?.message)}
							{...register('terminationDate')}
						/>
					)}
				</div>
			</fieldset>

			<fieldset className="flex flex-col gap-4">
				<legend className="mb-4 text-lg font-semibold">{t('form.vehicle')}</legend>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Select
						label={t('fields.driverCategory')}
						options={options(DRIVER_CATEGORIES, 'category')}
						{...register('driverCategory')}
					/>
					<Select
						label={t('fields.fleetArrangement')}
						options={options(FLEET_ARRANGEMENTS, 'fleet')}
						{...register('fleetArrangement')}
					/>
					<Input
						label={t('fields.assignedZone')}
						autoComplete="off"
						error={fieldError(errors.assignedZone?.message)}
						{...register('assignedZone')}
					/>
					<Input
						label={t('fields.commissionPerDrop')}
						inputMode="decimal"
						dir="ltr"
						error={fieldError(errors.commissionPerDrop?.message)}
						{...register('commissionPerDrop')}
					/>
					<Input
						label={t('fields.maxWeightCapacityKg')}
						inputMode="decimal"
						dir="ltr"
						error={fieldError(errors.maxWeightCapacityKg?.message)}
						{...register('maxWeightCapacityKg')}
					/>
					<Input
						label={t('fields.maxVolumeCapacityM3')}
						inputMode="decimal"
						dir="ltr"
						error={fieldError(errors.maxVolumeCapacityM3?.message)}
						{...register('maxVolumeCapacityM3')}
					/>
				</div>
			</fieldset>

			<fieldset className="flex flex-col gap-4">
				<legend className="mb-4 text-lg font-semibold">{t('form.compliance')}</legend>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<Input
						label={t('fields.licenseNumber')}
						required
						dir="ltr"
						autoComplete="off"
						error={fieldError(errors.licenseNumber?.message)}
						{...register('licenseNumber')}
					/>
					<Input
						label={t('fields.licenseClass')}
						required
						autoComplete="off"
						error={fieldError(errors.licenseClass?.message)}
						{...register('licenseClass')}
					/>
					<Input
						label={t('fields.licenseExpiryDate')}
						type="date"
						required
						error={fieldError(errors.licenseExpiryDate?.message)}
						{...register('licenseExpiryDate')}
					/>
					<Input
						label={t('fields.backgroundCheckDate')}
						type="date"
						error={fieldError(errors.backgroundCheckDate?.message)}
						{...register('backgroundCheckDate')}
					/>
					<Input
						label={t('fields.transitInsurancePolicy')}
						dir="ltr"
						autoComplete="off"
						error={fieldError(errors.transitInsurancePolicy?.message)}
						{...register('transitInsurancePolicy')}
					/>
					<Input
						label={t('fields.transitInsuranceExpiry')}
						type="date"
						error={fieldError(errors.transitInsuranceExpiry?.message)}
						{...register('transitInsuranceExpiry')}
					/>
				</div>
				<label className="flex w-fit cursor-pointer items-center gap-3 text-sm font-medium">
					<input
						type="checkbox"
						className="checkbox checkbox-sm"
						{...register('backgroundCheckPassed')}
					/>
					{t('fields.backgroundCheckPassed')}
				</label>
			</fieldset>

			{withPayroll && (
				<fieldset className="flex flex-col gap-4">
					<legend className="mb-4 text-lg font-semibold">{t('form.payroll')}</legend>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<Input
							label={t('fields.baseSalary')}
							inputMode="decimal"
							dir="ltr"
							error={fieldError(errors.baseSalary?.message)}
							{...register('baseSalary')}
						/>
						<Input
							label={t('fields.bankName')}
							autoComplete="off"
							error={fieldError(errors.bankName?.message)}
							{...register('bankName')}
						/>
					</div>
					<Input
						label={t('fields.bankAccountIban')}
						dir="ltr"
						autoComplete="off"
						error={fieldError(errors.bankAccountIban?.message)}
						{...register('bankAccountIban')}
					/>
				</fieldset>
			)}

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
					{driver ? t('form.save') : t('form.submit')}
				</Button>
			</div>
		</form>
	);
}
