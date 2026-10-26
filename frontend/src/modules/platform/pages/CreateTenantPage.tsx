import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Button, Input, ModulePage, PasswordInput, TipCard, useToast } from '@global-components';
import { ApiError } from '@services/api-client';
import { toSlug } from '@utils/slug';
import type { CreateTenantValues } from '../api';
import { CREATE_TENANT_DEFAULT_VALUES, CREATE_TENANT_FIELD_ERRORS } from '../constants';
import { useTenantMutations } from '../hooks/useTenantMutations';
import { createTenantSchema } from '../schemas/createTenantSchema';

export function CreateTenantPage() {
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

	const review = [
		{ label: 'Company', value: orgName.trim() || '—' },
		{ label: 'New administrator', value: username.trim() || '—' },
		{ label: 'Role', value: 'Tenant administrator' },
		{ label: 'Access', value: 'This company only' },
	];

	const onSubmit = handleSubmit((values) =>
		createTenant(values, {
			onSuccess: ({ tenant, administrator }) => {
				toast({
					variant: 'success',
					title: 'Tenant created',
					description: `${tenant.name} is ready. ${administrator.username} can now log in.`,
				});
				navigate(`/platform/tenants/${tenant.id}`, { replace: true });
			},
			onError: (error) => {
				const field =
					error instanceof ApiError && error.code
						? CREATE_TENANT_FIELD_ERRORS[
								error.code as keyof typeof CREATE_TENANT_FIELD_ERRORS
							]
						: undefined;
				if (field) setError(field, { message: error.message }, { shouldFocus: true });
				else
					toast({
						variant: 'error',
						title: "Couldn't create the tenant",
						description: error.message,
					});
			},
		}),
	);

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title="Create tenant & administrator"
				description="Set up the company and its first administrator in one step. Both are required."
			/>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<form
					noValidate
					onSubmit={onSubmit}
					className="flex flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8"
				>
					<section className="flex flex-col gap-4">
						<h2 className="text-lg font-semibold">Organization</h2>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								label="Organization name"
								placeholder="Meridian Courier"
								required
								error={errors.organization?.name?.message}
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
								label="Organization slug"
								placeholder="meridian-courier"
								required
								autoCapitalize="none"
								spellCheck={false}
								error={errors.organization?.slug?.message}
								{...register('organization.slug')}
							/>
							<Input
								label="Contact email"
								type="email"
								placeholder="office@meridian.example.test"
								required
								error={errors.organization?.contactEmail?.message}
								{...register('organization.contactEmail')}
							/>
							<Input
								label="Phone (optional)"
								type="tel"
								placeholder="+962 7 9000 0000"
								error={errors.organization?.contactPhone?.message}
								{...register('organization.contactPhone')}
							/>
							<Input
								label="Address (optional)"
								placeholder="14 Al-Madina Street, Amman"
								containerClassName="md:col-span-2"
								error={errors.organization?.address?.message}
								{...register('organization.address')}
							/>
						</div>
					</section>

					<section className="flex flex-col gap-4">
						<div>
							<h2 className="text-lg font-semibold">
								First tenant administrator · Required
							</h2>
							<p className="mt-2 text-sm text-slate">
								A new account is created with this tenant. Company permissions only.
							</p>
						</div>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								label="Username"
								placeholder="lina.haddad"
								required
								autoComplete="off"
								autoCapitalize="none"
								spellCheck={false}
								error={errors.administrator?.username?.message}
								{...register('administrator.username')}
							/>
							<Input
								label="Login email"
								type="email"
								placeholder="lina@meridian.example.test"
								required
								autoComplete="off"
								error={errors.administrator?.email?.message}
								{...register('administrator.email')}
							/>
							<PasswordInput
								label="Initial password"
								required
								autoComplete="new-password"
								containerClassName="md:col-span-2"
								error={errors.administrator?.password?.message}
								{...register('administrator.password')}
							/>
						</div>
						<p className="text-xs text-slate">
							8-128 characters with an upper-case letter, a lower-case letter, a
							number and a symbol. Hand over credentials securely. Passwords are
							hidden from confirmation and audit records.
						</p>
					</section>

					<div className="flex flex-col gap-2 sm:flex-row">
						<button
							type="button"
							className="btn border-0 bg-base-200"
							onClick={() => navigate(-1)}
						>
							Cancel
						</button>
						<Button type="submit" disabled={isCreating}>
							{isCreating && (
								<span
									className="loading loading-spinner loading-sm"
									aria-hidden="true"
								/>
							)}
							{isCreating ? 'Creating…' : 'Create tenant & administrator'}
						</Button>
					</div>
				</form>
				<aside className="flex flex-col gap-6">
					<section className="rounded-box bg-base-200 p-6 md:p-8">
						<h2 className="text-lg font-semibold">Review before creating</h2>
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
					<TipCard
						title="A company starts with its administrator."
						description="Create the company, account and membership together. The administrator logs in, then creates company users."
					/>
				</aside>
			</div>
		</div>
	);
}
