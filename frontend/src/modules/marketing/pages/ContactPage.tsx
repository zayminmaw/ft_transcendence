import { useState } from 'react';
import type { ParseKeys } from 'i18next';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@global-components';
import { PageIntro } from '../components/PageIntro';

const key = (value: ParseKeys<'marketing'>) => value;

// Messages are translation keys, translated when shown.
const briefSchema = z.object({
	company: z.string().trim().min(2, key('contact.errors.company')).max(120),
	drivers: z
		.string()
		.regex(/^[1-9]\d*$/, key('contact.errors.drivers'))
		.refine((value) => Number(value) <= 100000, key('contact.errors.driversMax')),
	priority: z.enum(['dispatch', 'cod', 'fleet', 'merchants']),
});
type Brief = z.infer<typeof briefSchema>;
const questions = ['flow', 'cash', 'access'] as const;

export function ContactPage() {
	const { t } = useTranslation('marketing');
	const [brief, setBrief] = useState<Brief | null>(null);
	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<Brief>({
		resolver: zodResolver(briefSchema),
		defaultValues: { company: '', drivers: '', priority: 'dispatch' },
	});
	const fieldError = (message?: string) => message && t(message as ParseKeys<'marketing'>);

	function downloadBrief() {
		if (!brief) return;
		const text = t('contact.file.text', {
			company: brief.company,
			drivers: brief.drivers,
			priority: t(`contact.priorities.${brief.priority}`),
		});
		const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = t('contact.file.name');
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	return (
		<>
			<PageIntro
				eyebrow={t('contact.eyebrow')}
				title={t('contact.title')}
				description={t('contact.description')}
			/>
			<section className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 md:px-10 lg:grid-cols-2">
				<form
					className="card border border-base-300 bg-base-100"
					onSubmit={handleSubmit((data) => setBrief(data))}
				>
					<div className="card-body gap-6 p-6 md:p-8">
						<h2 className="card-title">{t('contact.formTitle')}</h2>
						<Input
							label={t('contact.company')}
							autoComplete="organization"
							error={fieldError(errors.company?.message)}
							{...register('company')}
						/>
						<Input
							label={t('contact.drivers')}
							inputMode="numeric"
							error={fieldError(errors.drivers?.message)}
							{...register('drivers')}
						/>
						<div>
							<label
								htmlFor="rollout-priority"
								className="mb-2 block text-sm font-medium"
							>
								{t('contact.priority')}
							</label>
							<select
								id="rollout-priority"
								className="select w-full"
								aria-invalid={Boolean(errors.priority)}
								aria-describedby={errors.priority ? 'priority-error' : undefined}
								{...register('priority')}
							>
								{briefSchema.shape.priority.options.map((priority) => (
									<option key={priority} value={priority}>
										{t(`contact.priorities.${priority}`)}
									</option>
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
							{isSubmitting ? t('contact.preparing') : t('contact.create')}
						</Button>
					</div>
				</form>
				<div>
					<h2 className="marketing-title text-3xl">{t('contact.conversationTitle')}</h2>
					<ul className="mt-6 list-disc space-y-4 ps-5 leading-relaxed opacity-70">
						{questions.map((question) => (
							<li key={question}>{t(`contact.questions.${question}`)}</li>
						))}
					</ul>
					{brief && (
						<div
							role="status"
							className="mt-8 rounded-xl border border-secondary/25 bg-base-100 p-6"
						>
							<p className="text-xs font-semibold uppercase tracking-wide text-secondary">
								{t('contact.ready')}
							</p>
							<h3 className="mt-3 text-xl font-semibold">{brief.company}</h3>
							<p className="mt-2 text-sm opacity-70">
								{t('contact.summary', {
									drivers: brief.drivers,
									priority: t(`contact.priorities.${brief.priority}`),
								})}
							</p>
							<Button className="mt-5" onClick={downloadBrief}>
								{t('contact.download')}
							</Button>
						</div>
					)}
				</div>
			</section>
		</>
	);
}
