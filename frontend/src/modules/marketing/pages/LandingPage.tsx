import { Link } from 'react-router-dom';
import { WorkflowPreview } from '../components/WorkflowPreview';

export function LandingPage() {
	return (
		<>
			<section className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-16 md:px-10 md:py-24 lg:grid-cols-[1.1fr_1fr]">
				<div>
					<p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-base-content">
						Last-mile delivery. The whole picture.
					</p>
					<h1 className="marketing-title max-w-2xl text-6xl sm:text-7xl lg:text-8xl">
						From first pickup
						<br />
						to <span className="text-base-content">final payout.</span>
					</h1>
					<p className="mt-8 max-w-lg text-lg leading-relaxed opacity-70">
						Your parcels, people, and finances belong in the same conversation. Meet a
						logistics workspace designed to connect them.
					</p>
					<div className="mt-9 flex flex-wrap gap-3">
						<Link to="/product" className="btn btn-primary">
							Explore the product <span aria-hidden="true">→</span>
						</Link>
						<Link to="/app" className="btn btn-outline">
							View workspace preview
						</Link>
					</div>
					<p className="mt-5 text-xs opacity-60">
						Built around courier operations, merchant accounts, and COD reconciliation.
					</p>
				</div>
				<div className="marketing-grid relative isolate rounded-2xl p-3 sm:p-6">
					<div
						aria-hidden="true"
						className="absolute inset-5 -z-10 rotate-3 rounded-2xl border border-base-300 bg-base-200"
					/>
					<WorkflowPreview />
				</div>
			</section>
			<section className="border-y border-base-300 bg-base-100">
				<div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-[1fr_2fr] md:px-10">
					<p className="text-sm font-semibold uppercase tracking-wider opacity-60">
						One operation.
						<br />
						Many moving parts.
					</p>
					<div className="grid gap-8 sm:grid-cols-3">
						{[
							{
								title: 'At the desk',
								text: 'Merchant profiles, parcel intake, and dispatch coordination.',
							},
							{
								title: 'On the road',
								text: 'Drivers, fleet assignments, and delivery milestones.',
							},
							{
								title: 'In the books',
								text: 'Cash handovers, delivery charges, and merchant ledgers.',
							},
						].map(({ title, text }) => (
							<div key={title}>
								<h2 className="text-lg font-semibold">{title}</h2>
								<p className="mt-3 text-sm leading-relaxed opacity-65">{text}</p>
							</div>
						))}
					</div>
				</div>
			</section>
			<section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:px-10 md:py-24 lg:grid-cols-2">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content">
						Designed for the handoffs
					</p>
					<h2 className="marketing-title mt-5 text-4xl md:text-5xl">
						The delivery ends.
						<br />
						The responsibility doesn’t.
					</h2>
					<p className="mt-6 max-w-lg leading-relaxed opacity-70">
						A delivered parcel is only part of the job. Cash still needs to be checked,
						charges accounted for, and merchants settled. Transcend’s blueprint follows
						that entire journey.
					</p>
					<Link to="/solutions" className="link mt-6 inline-block font-semibold">
						See how the teams connect <span aria-hidden="true">→</span>
					</Link>
				</div>
				<div className="space-y-6 border-s border-base-300 ps-8">
					{[
						{
							title: 'Keep the merchant in view',
							text: 'Connect each shipment to the account, agreed rates, and recipient details behind it.',
						},
						{
							title: 'Make responsibilities clear',
							text: 'Bring dispatch, couriers, finance, HR, and fleet management into defined roles.',
						},
						{
							title: 'Close the financial loop',
							text: 'Design reconciliation around a transaction-backed ledger, from collection to settlement.',
						},
					].map(({ title, text }, index) => (
						<div key={title}>
							<span className="text-xs font-semibold text-base-content">
								0{index + 1}
							</span>
							<h3 className="mt-2 text-lg font-semibold">{title}</h3>
							<p className="mt-2 text-sm leading-relaxed opacity-65">{text}</p>
						</div>
					))}
				</div>
			</section>
			<section className="bg-neutral text-neutral-content">
				<div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 py-14 md:flex-row md:items-center md:px-10">
					<div>
						<h2 className="marketing-title text-4xl">Start with your operation.</h2>
						<p className="mt-4 max-w-xl opacity-70">
							Outline your team, your fleet, and the handoffs you want to improve.
						</p>
					</div>
					<Link to="/contact" className="btn btn-primary">
						Plan your rollout <span aria-hidden="true">→</span>
					</Link>
				</div>
			</section>
		</>
	);
}
