import type { ParseKeys } from 'i18next';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Button, Input, ModulePage, PasswordInput, TipCard, useToast } from '@global-components';
import { fromErrorCode } from '@services/api-client';
import { toSlug } from '@utils/slug';
import type { CreateTenantValues } from '../api';
import { CREATE_TENANT_DEFAULT_VALUES, CREATE_TENANT_FIELD_ERRORS } from '../constants';
import { useTenantMutations } from '../hooks/useTenantMutations';
import { createTenantSchema } from '../schemas/createTenantSchema';
import { platformErrorKey } from '../errors';

export function CreateTenantPage() {
	const { t } = useTranslation('platform');
	const navigate = useNavigate();
	const { toast } = useToast();
	const { createTenant, isCreating } = useTenantMutations();
	const {
		register,
		handleSubmit,
		setError,
		setValue,
		control,
		getFieldState,
		formState: { errors },
	} = useForm<CreateTenantValues>({
		resolver: zodResolver(createTenantSchema),
		defaultValues: CREATE_TENANT_DEFAULT_VALUES,
	});
	const [orgName, username] = useWatch({
		control,
		name: ['organization.name', 'administrator.username'],
	});
	const fieldError = (message?: string) => message && t(message as ParseKeys<'platform'>);

	const review = [
		{ label: t('create.reviewCompany'), value: orgName.trim() || '—' },
		{ label: t('create.reviewAdministrator'), value: username.trim() || '—' },
		{ label: t('create.reviewRole'), value: t('create.roleValue') },
		{ label: t('create.reviewAccess'), value: t('create.accessValue') },
	];

	const onSubmit = handleSubmit((values) =>
		createTenant(values, {
			onSuccess: ({ tenant, administrator }) => {
				toast({
					variant: 'success',
					title: t('create.created'),
					description: t('create.createdText', {
						tenant: tenant.name,
						username: administrator.username,
					}),
				});
				navigate(`/platform/tenants/${tenant.id}`, { replace: true });
			},
			onError: (error) => {
				const field = fromErrorCode(CREATE_TENANT_FIELD_ERRORS, error);
				if (field)
					setError(field, { message: t(platformErrorKey(error)) }, { shouldFocus: true });
				else
					toast({
						variant: 'error',
						title: t('create.failed'),
						description: t(platformErrorKey(error)),
					});
			},
		}),
	);

	return (
		<div className="flex flex-col gap-6">
			<ModulePage title={t('create.title')} description={t('create.description')} />
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<form
					noValidate
					onSubmit={onSubmit}
					className="flex flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8"
				>
					<section className="flex flex-col gap-4">
						<h2 className="text-lg font-semibold">{t('create.organization')}</h2>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								label={t('fields.organizationName')}
								placeholder="Meridian Courier"
								required
								error={fieldError(errors.organization?.name?.message)}
								{...register('organization.name', {
									// The slug follows the name until it is edited by hand.
									onChange: (event: { target: { value: string } }) => {
										if (!getFieldState('organization.slug').isDirty)
											setValue(
												'organization.slug',
												toSlug(event.target.value),
											);
									},
								})}
							/>
							<Input
								label={t('fields.organizationSlug')}
								placeholder="meridian-courier"
								required
								autoCapitalize="none"
								spellCheck={false}
								dir="ltr"
								error={fieldError(errors.organization?.slug?.message)}
								{...register('organization.slug')}
							/>
							<Input
								label={t('fields.contactEmail')}
								type="email"
								placeholder="office@meridian.example.test"
								required
								error={fieldError(errors.organization?.contactEmail?.message)}
								{...register('organization.contactEmail')}
							/>
							<Input
								label={t('fields.phoneOptional')}
								type="tel"
								placeholder="+962 7 9000 0000"
								error={fieldError(errors.organization?.contactPhone?.message)}
								{...register('organization.contactPhone')}
							/>
							<Input
								label={t('fields.addressOptional')}
								placeholder="14 Al-Madina Street, Amman"
								containerClassName="md:col-span-2"
								error={fieldError(errors.organization?.address?.message)}
								{...register('organization.address')}
							/>
						</div>
					</section>

					<section className="flex flex-col gap-4">
						<div>
							<h2 className="text-lg font-semibold">{t('create.administrator')}</h2>
							<p className="mt-2 text-sm text-slate">
								{t('create.administratorNote')}
							</p>
						</div>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								label={t('fields.username')}
								placeholder="lina.haddad"
								required
								autoComplete="off"
								autoCapitalize="none"
								spellCheck={false}
								dir="ltr"
								error={fieldError(errors.administrator?.username?.message)}
								{...register('administrator.username')}
							/>
							<Input
								label={t('fields.loginEmail')}
								type="email"
								placeholder="lina@meridian.example.test"
								required
								autoComplete="off"
								error={fieldError(errors.administrator?.email?.message)}
								{...register('administrator.email')}
							/>
							<PasswordInput
								label={t('fields.initialPassword')}
								required
								autoComplete="new-password"
								containerClassName="md:col-span-2"
								error={fieldError(errors.administrator?.password?.message)}
								{...register('administrator.password')}
							/>
						</div>
						<p className="text-xs text-slate">{t('create.passwordNote')}</p>
					</section>

					<div className="flex flex-col gap-2 sm:flex-row">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(-1)}
						>
							{t('common.cancel')}
						</button>
						<Button type="submit" disabled={isCreating}>
							{isCreating && (
								<span
									className="loading loading-spinner loading-sm"
									aria-hidden="true"
								/>
							)}
							{isCreating ? t('create.creating') : t('create.submit')}
						</Button>
					</div>
				</form>
				<aside className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">{t('create.review')}</h2>
						<dl className="mt-6 flex flex-col gap-5">
							{review.map((item) => (
								<div key={item.label}>
									<dt className="text-sm text-slate">{item.label}</dt>
									<dd className="mt-1 text-lg font-semibold break-words">
										{item.value}
									</dd>
								</div>
							))}
						</dl>
					</section>
					<TipCard title={t('create.tipTitle')} description={t('create.tipText')} />
				</aside>
			</div>
		</div>
	);
}
