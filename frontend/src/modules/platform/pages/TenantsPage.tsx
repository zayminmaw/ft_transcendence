import { Link } from 'react-router-dom';

export function TenantsPage() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h1
						id="workspace-page-title"
						className="workspace-title text-[2rem] md:text-[2.5rem]"
					>
						Tenant administration
					</h1>
					<p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--color-slate)]">
						Organization access, tenant ownership, and management activity.
					</p>
				</div>
				<Link
					to="/platform/tenants/new"
					className="btn btn-primary w-full md:w-auto md:px-12"
				>
					Create tenant
				</Link>
			</div>
		</div>
	);
}
