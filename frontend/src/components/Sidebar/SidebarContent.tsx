import { NavLink } from 'react-router-dom';

const modules = [
	'organizations',
	'clients',
	'staff',
	'drivers',
	'assets',
	'parcels',
	'billing',
	'rbac',
];

export function SidebarContent() {
	return (
		<nav className="flex flex-col gap-2">
			<p className="text-4xl font-semibold">transcend</p>
			<div className="rounded-lg bg-zinc-100 p-2 my-4">
				<p className="text-sm mb-1">Platform administration</p>
				<p className="text-zinc-500 text-xs">Platform admin</p>
			</div>
			{modules.map((module) => (
				<NavLink
					key={module}
					to={`/app/${module}`}
					className={({ isActive }) =>
						`rounded-lg p-2 text-sm font-medium capitalize ${isActive ? 'bg-zinc-100 text-black' : 'hover:bg-zinc-50 text-zinc-700'}`
					}
				>
					{module === 'rbac' ? 'Access control' : module}
				</NavLink>
			))}
		</nav>
	);
}
