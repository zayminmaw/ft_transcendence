import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@components';
import { PageIntro } from '../components/PageIntro';

const briefSchema = z.object({
	company: z.string().trim().min(2, 'Enter a company name with at least 2 characters.').max(120),
	drivers: z
		.string()
		.regex(/^[1-9]\d*$/, 'Enter the number of drivers, starting from 1.')
		.refine((value) => Number(value) <= 100000, 'Enter a number up to 100,000.'),
	priority: z.enum([
		'Dispatch coordination',
		'COD reconciliation',
		'Fleet and people',
		'Merchant accounts',
	]),
});
type Brief = z.infer<typeof briefSchema>;

export function ContactPage() {
	const [brief, setBrief] = useState<Brief | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<Brief>({
		resolver: zodResolver(briefSchema),
		defaultValues: { company: '', drivers: '', priority: 'Dispatch coordination' },
	});

	function downloadBrief() {
		if (!brief) return;
		const text = `Transcend operations brief\n\nCompany: ${brief.company}\nDrivers: ${brief.drivers}\nPriority: ${brief.priority}\n\nNext: document your current workflow, the teams involved, and the handoffs to improve.\n`;
		const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'transcend-operations-brief.txt';
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	return (
		<>
			<PageIntro
				eyebrow="Plan your rollout"
				title="Start with the way you work."
				description="Create a simple operations brief to help your team discuss what comes next. Your details stay in this browser; nothing is sent or saved to a server."
			/>
			<section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 md:px-10 lg:grid-cols-2">
				<form
					className="card border border-base-300 bg-base-100"
					onSubmit={handleSubmit((data) => setBrief(data))}
				>
					<div className="card-body gap-6 p-6 md:p-8">
						<h2 className="card-title">Your operations brief</h2>
						<Input
							label="Company name"
							autoComplete="organization"
							error={errors.company?.message}
							{...register('company')}
						/>
						<Input
							label="Number of drivers"
							inputMode="numeric"
							error={errors.drivers?.message}
							{...register('drivers')}
						/>
						<div>
							<label
								htmlFor="rollout-priority"
								className="mb-2 block text-sm font-medium"
							>
								First priority
							</label>
							<select
								id="rollout-priority"
								className="select w-full"
								aria-invalid={Boolean(errors.priority)}
								aria-describedby={errors.priority ? 'priority-error' : undefined}
								{...register('priority')}
							>
								{briefSchema.shape.priority.options.map((priority) => (
									<option key={priority}>{priority}</option>
								))}
							</select>
							{errors.priority && (
								<p
									id="priority-error"
									role="alert"
									className="mt-1 text-sm text-error"
								>
									{errors.priority.message}
								</p>
							)}
						</div>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Preparing…' : 'Create brief'}
						</Button>
					</div>
				</form>
				<div>
					<h2 className="marketing-title text-3xl">A useful starting conversation.</h2>
					<ul className="mt-6 list-disc space-y-4 pl-5 leading-relaxed opacity-70">
						<li>How does a parcel move from merchant intake to its assigned driver?</li>
						<li>Where are cash handovers and discrepancies recorded today?</li>
						<li>Which teams need access to each part of the operation?</li>
					</ul>
					{brief && (
						<div
							role="status"
							className="mt-8 rounded-xl border border-secondary/25 bg-base-100 p-6"
						>
							<p className="text-xs font-semibold uppercase tracking-wide text-secondary">
								Brief ready
							</p>
							<h3 className="mt-3 text-xl font-semibold">{brief.company}</h3>
							<p className="mt-2 text-sm opacity-70">
								{brief.drivers} drivers · {brief.priority}
							</p>
							<Button className="mt-5" onClick={downloadBrief}>
								Download your brief
							</Button>
						</div>
					)}
				</div>
			</section>
		</>
	);
}
