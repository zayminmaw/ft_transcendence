import { Input, ModulePage } from '@global-components';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function CreateTenantPage() {
	const navigate = useNavigate();
	const [orgName, setOrgName] = useState('');
	const [username, setUsername] = useState('');

	const review = [
		{ label: 'Company', value: orgName.trim() || '—' },
		{ label: 'New administrator', value: username.trim() || '—' },
		{ label: 'Role', value: 'Tenant administrator' },
		{ label: 'Access', value: 'This company only' },
	];

	return (
		<div className="flex flex-col gap-6">
			<ModulePage
				title="Create tenant & administrator"
				description="Set up the company and its first administrator in one step. Both are required."
			/>
			<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<form className="flex flex-col gap-6 rounded-box border border-base-300 p-4 md:p-8">
					<section className="flex flex-col gap-4">
						<h2 className="text-lg font-semibold">Organization</h2>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<Input
								id="orgName"
								name="orgName"
								label="Organization name"
								placeholder="Meridian Courier"
								required
								value={orgName}
								onChange={(e) => setOrgName(e.target.value)}
							/>
							<Input
								id="orgSlug"
								name="orgSlug"
								label="Organization slug"
								placeholder="meridian-courier"
								required
							/>
							<Input
								id="contactEmail"
								name="contactEmail"
								label="Contact email"
								type="email"
								placeholder="office@meridian.example.test"
								required
							/>
							<Input
								id="phone"
								name="phone"
								label="Phone (optional)"
								type="tel"
								placeholder="+962 7 9000 0000"
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
								id="username"
								name="username"
								label="Username"
								placeholder="lina.haddad"
								required
								value={username}
								onChange={(e) => setUsername(e.target.value)}
							/>
							<Input
								id="loginEmail"
								name="loginEmail"
								label="Login email"
								type="email"
								placeholder="lina@meridian.example.test"
								required
							/>
							<Input
								id="password"
								name="password"
								label="Initial password"
								type="password"
								required
								containerClassName="md:col-span-2"
							/>
						</div>
						<p className="text-xs text-slate">
							Hand over credentials securely. Passwords are hidden from confirmation
							and audit records.
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
						<button type="submit" className="btn btn-primary">
							Create tenant & administrator
						</button>
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
					<section className="rounded-box bg-neutral p-6 text-neutral-content md:p-8">
						<h2 className="workspace-title text-[2rem]">
							A company starts with its administrator.
						</h2>
						<p className="mt-6 leading-relaxed">
							Create the company, account and membership together. The administrator
							logs in, then creates company users.
						</p>
					</section>
				</aside>
			</div>
		</div>
	);
}
