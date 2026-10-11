import { Link } from 'react-router-dom';
import { PageIntro } from '../components/PageIntro';
import { WorkflowPreview } from '../components/WorkflowPreview';

const domains = [
	['01', 'Merchants & organizations', 'A foundation for account details, memberships, and clearly separated organizations.'],
	['02', 'Parcels & dispatch', 'A shipment journey covering waybills, route assignments, status changes, and proof of delivery.'],
	['03', 'People & fleet', 'Connected profiles for office staff and drivers, alongside vehicles, equipment, and maintenance.'],
	['04', 'Billing & reconciliation', 'A ledger-centered design for COD handovers, delivery charges, invoices, and merchant settlements.'],
];

export function ProductPage() {
	return <>
		<PageIntro eyebrow="The product blueprint" title="One workspace, from intake to settlement." description="Transcend is being built around the distinct responsibilities of a courier business, with shared context between each team." />
		<section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 md:px-10 lg:grid-cols-2">
			<div>{domains.map(([number, title, text]) => <article key={number} className="border-t border-base-300 py-7"><span className="text-xs font-semibold text-base-content">{number}</span><h2 className="mt-3 text-2xl font-semibold">{title}</h2><p className="mt-3 max-w-lg leading-relaxed opacity-65">{text}</p></article>)}</div>
			<div className="lg:pt-7"><WorkflowPreview /><div className="mt-8 rounded-xl border border-base-300 p-6"><h2 className="font-semibold">Explore the workspace preview</h2><p className="mt-3 text-sm leading-relaxed opacity-65">The preview introduces the module structure. Operational features and account access are still in development.</p><Link to="/app" className="btn btn-outline mt-5">Open preview <span aria-hidden="true">↗</span></Link></div></div>
		</section>
	</>;
}
