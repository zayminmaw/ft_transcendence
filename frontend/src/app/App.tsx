import { NavLink, Outlet } from 'react-router-dom';

const modules = ['organizations', 'clients', 'staff', 'drivers', 'assets', 'parcels', 'billing', 'rbac'];

export function App() {
  return <div className="min-h-screen bg-base-200 text-base-content">
    <header className="navbar justify-between border-b border-base-300 bg-base-100 px-6 py-5">
      <NavLink to="/app" className="text-xl font-bold tracking-tight">Transcend <span className="ml-2 text-xs font-medium uppercase tracking-widest opacity-60">Workspace</span></NavLink>
      <NavLink to="/" className="btn btn-ghost btn-sm">Back to website</NavLink>
    </header>
    <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 md:grid-cols-[210px_1fr]">
      <nav aria-label="Main navigation" className="flex flex-wrap gap-2 md:flex-col">
        {modules.map((module) => <NavLink key={module} to={`/app/${module}`} className={({ isActive }) => `rounded-lg px-4 py-3 text-sm font-medium capitalize ${isActive ? 'bg-neutral text-neutral-content' : 'hover:bg-base-300'}`}>{module === 'rbac' ? 'Access control' : module}</NavLink>)}
      </nav>
      <main className="rounded-2xl border border-base-300 bg-base-100 p-6 md:p-10"><Outlet /></main>
    </div>
  </div>;
}
