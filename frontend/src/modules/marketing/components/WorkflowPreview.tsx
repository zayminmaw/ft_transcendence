import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const workflows = {
	delivery: ['pickup', 'sorted', 'outForDelivery', 'delivered'],
	settlement: ['collected', 'handedOver', 'posted', 'settled'],
} as const;
type Workflow = keyof typeof workflows;

export function WorkflowPreview() {
	const { t } = useTranslation('marketing');
	const [workflow, setWorkflow] = useState<Workflow>('delivery');
	const step = (name: string, part: 'title' | 'detail') =>
		t(`workflow.${workflow}.${name}.${part}` as 'workflow.delivery.pickup.title');
	return (
		<div className="workflow-sheet card border border-base-300 bg-base-100">
			<div className="card-body gap-6 p-6 md:p-8">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<span className="text-sm font-semibold">{t('workflow.heading')}</span>
					<span className="badge badge-outline badge-sm">{t('workflow.badge')}</span>
				</div>
				<div aria-label={t('workflow.label')} className="flex gap-2">
					{(Object.keys(workflows) as Workflow[]).map((name) => (
						<button
							key={name}
							type="button"
							aria-pressed={workflow === name}
							className={`btn btn-sm ${workflow === name ? 'btn-neutral' : 'btn-ghost'}`}
							onClick={() => setWorkflow(name)}
						>
							{t(`workflow.${name}.name`)}
						</button>
					))}
				</div>
				<ol
					aria-label={t('workflow.steps', { workflow: t(`workflow.${workflow}.name`) })}
					className="space-y-6"
				>
					{workflows[workflow].map((name, index) => (
						<li key={name} className="flex gap-4">
							<span className="grid size-9 shrink-0 place-items-center rounded-full border border-base-300 bg-primary/5 text-xs font-semibold text-base-content">
								0{index + 1}
							</span>
							<div>
								<h3 className="font-semibold">{step(name, 'title')}</h3>
								<p className="mt-1 text-sm leading-relaxed opacity-65">
									{step(name, 'detail')}
								</p>
							</div>
						</li>
					))}
				</ol>
				<p className="border-t border-base-300 pt-4 text-xs opacity-60">
					{t('workflow.footnote')}
				</p>
			</div>
		</div>
	);
}
