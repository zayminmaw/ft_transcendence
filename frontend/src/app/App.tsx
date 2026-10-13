import { SidebarContent } from '@components';
import { Outlet } from 'react-router-dom';

export function App() {
	return (
		<div className="flex h-full">
			<div className="hidden md:block md:w-60 h-full p-4">
				<SidebarContent />
			</div>
			<div className="max-h-screen flex-1 overflow-y-auto">
				<Outlet />
			</div>
		</div>
	);
}
