import { Link } from 'react-router-dom';
import { PageIntro } from '../components/PageIntro';

const teams = [
	{
		name: 'Dispatch & hub operations',
		question: 'What needs to move next?',
		text: 'Shape a workflow for merchant intake, sorting, courier assignment, and parcel exceptions.',
		modules: 'Clients · Parcels · Drivers · Assets',
	},
	{
		name: 'Couriers & fleet leads',
		question: 'Who is taking it there?',
		text: 'Connect the people on the road with their vehicles, duty status, compliance records, and delivery responsibilities.',
		modules: 'Drivers · Assets · Parcels',
	},
	{
		name: 'Finance & merchant accounts',
		question: 'Has the money been reconciled?',
		text: 'Plan cash handovers, discrepancies, delivery fees, and settlements around a clear merchant ledger.',
		modules: 'Clients · Billing · Parcels',
	},
	{
		name: 'People & administration',
		question: 'Does everyone have the right access?',
		text: 'Separate office staff and driver profiles, then define membership and permissions around each role.',
		modules: 'Organizations · Staff · Access control',
	},
];

export function SolutionsPage() {
	return (
		<>
			<PageIntro
				eyebrow="Built around your teams"
				title="Different roles. A shared direction."
				description="Every team sees a different part of the delivery. The blueprint brings those responsibilities together without losing the boundaries between them."
			/>
			<section className="mx-auto max-w-7xl px-6 pb-20 md:px-10">
				{teams.map(({ name, question, text, modules }, index) => (
					<article
						key={name}
						className="grid gap-5 border-t border-base-300 py-9 md:grid-cols-[1fr_1.4fr]"
					>
						<div>
							<p className="text-xs font-semibold text-base-content">0{index + 1}</p>
							<h2 className="mt-3 text-xl font-semibold">{name}</h2>
						</div>
						<div>
							<h3 className="marketing-title text-3xl">{question}</h3>
							<p className="mt-4 max-w-xl leading-relaxed opacity-65">{text}</p>
							<p className="mt-5 text-xs font-medium uppercase tracking-wide opacity-60">
								{modules}
							</p>
						</div>
					</article>
				))}
				<div className="mt-8 flex flex-wrap items-center justify-between gap-6 rounded-xl bg-base-100 p-8">
					<p className="text-lg font-semibold">
						Map the handoffs that matter to your team.
					</p>
					<Link to="/contact" className="btn btn-primary">
						Create an operations brief
					</Link>
				</div>
			</section>
		</>
	);
}
