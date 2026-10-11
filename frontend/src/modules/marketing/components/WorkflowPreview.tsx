import { useState } from 'react';

const workflows = {
	Delivery: [
		{ title: 'Pickup scheduled', detail: 'Merchant and recipient details connected to one waybill.' },
		{ title: 'Sorted at the hub', detail: 'Ready for the next route and assigned courier.' },
		{ title: 'Out for delivery', detail: 'A clear handoff from the dispatch desk to the field.' },
		{ title: 'Delivered', detail: 'Proof of delivery closes the operational journey.' },
	],
	Settlement: [
		{ title: 'COD collected', detail: 'The courier records the recipient payment.' },
		{ title: 'Cash handed over', detail: 'Finance checks expected collections against cash received.' },
		{ title: 'Ledger posted', detail: 'Reconciled COD and charges update the merchant ledger together.' },
		{ title: 'Merchant settled', detail: 'A payout or invoice closes the billing cycle.' },
	],
};

export function WorkflowPreview() {
	const [workflow, setWorkflow] = useState<keyof typeof workflows>('Delivery');
	return <div className="workflow-sheet card border border-base-300 bg-base-100">
		<div className="card-body gap-6 p-6 md:p-8">
			<div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-semibold">Every handoff, connected</span><span className="badge badge-outline badge-sm">Illustrative workflow</span></div>
			<div aria-label="Workflow preview" className="flex gap-2">
				{(Object.keys(workflows) as (keyof typeof workflows)[]).map((name) => <button key={name} type="button" aria-pressed={workflow === name} className={`btn btn-sm ${workflow === name ? 'btn-neutral' : 'btn-ghost'}`} onClick={() => setWorkflow(name)}>{name}</button>)}
			</div>
			<ol aria-label={`${workflow} steps`} className="space-y-6">
				{workflows[workflow].map(({ title, detail }, index) => <li key={title} className="flex gap-4">
					<span className="grid size-9 shrink-0 place-items-center rounded-full border border-base-300 bg-primary/5 text-xs font-semibold text-base-content">0{index + 1}</span>
					<div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed opacity-65">{detail}</p></div>
				</li>)}
			</ol>
			<p className="border-t border-base-300 pt-4 text-xs opacity-60">An overview of the workflows Transcend is designed to bring together.</p>
		</div>
	</div>;
}
