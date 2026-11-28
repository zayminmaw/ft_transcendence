import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, useToast } from '@global-components';
import { useCan } from '@modules/auth';
import { ApiError } from '@services/api-client';
import {
	downloadCompanyExport,
	EXPORT_SECTIONS,
	type ExportFormat,
	type ExportSection,
} from '../api';

const INCLUDED_DATASETS = [
	'organization',
	'members',
	'clients',
	'drivers',
	'assets',
	'parcels',
	'invoices',
] as const;

// Tenant Admin only: exports the currently open company's records as JSON or RFC-4180 CSV.
// Authentication uses the bearer token + X-Organization-Id header via apiDownload (never URL tokens).
export function CompanyDataExport({ slug }: { slug?: string }) {
	const { t } = useTranslation('rbac');
	const can = useCan();
	const { toast } = useToast();
	const [section, setSection] = useState<ExportSection>('all');
	const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
	const [error, setError] = useState<string | null>(null);

	if (!can('admin.manage_users')) {
		return (
			<p role="alert" className="alert alert-soft text-sm">
				{t('export.noAccess')}
			</p>
		);
	}

	const runExport = async (format: ExportFormat, selectedSection: ExportSection = 'all') => {
		if (activeFormat !== null) return;
		setActiveFormat(format);
		setError(null);
		try {
			const { filename } = await downloadCompanyExport({
				format,
				section: selectedSection,
				slug,
			});
			toast({ variant: 'success', title: t('export.successToast', { filename }) });
		} catch (err) {
			const message =
				err instanceof ApiError && err.status === 403
					? t('export.noAccess')
					: t('export.errorToast');
			setError(message);
			toast({ variant: 'error', title: message });
		} finally {
			setActiveFormat(null);
		}
	};

	const handleCsvSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		void runExport('csv', section);
	};

	const sectionOptions = EXPORT_SECTIONS.map((value) => ({
		value,
		label: t(`export.sections.${value}`),
	}));

	return (
		<div className="flex flex-col gap-4">
			{error && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{error}
				</p>
			)}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<article className="flex flex-col justify-between gap-6 rounded-box border border-base-300 bg-base-100 p-6">
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2.5">
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.75"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-5 w-5 shrink-0 text-primary"
							>
								<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
								<polyline points="14 2 14 8 20 8" />
								<path d="M10 13a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1" />
								<path d="M14 19a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1" />
							</svg>
							<h3 className="font-semibold">{t('export.jsonTitle')}</h3>
						</div>
						<p className="text-sm text-[var(--color-slate)]">
							{t('export.jsonDescription')}
						</p>
						<div>
							<p className="mb-2 text-xs font-medium text-[var(--color-slate)]">
								{t('export.includedLabel')}
							</p>
							<ul className="flex flex-wrap gap-1.5" role="list">
								{INCLUDED_DATASETS.map((dataset) => (
									<li key={dataset} className="badge badge-soft badge-sm">
										{t(`export.sections.${dataset}`)}
									</li>
								))}
							</ul>
						</div>
					</div>
					<div>
						<button
							type="button"
							className="btn btn-primary"
							disabled={activeFormat !== null}
							onClick={() => void runExport('json', 'all')}
						>
							{activeFormat === 'json' && (
								<span
									className="loading loading-spinner loading-xs"
									aria-hidden="true"
								/>
							)}
							{activeFormat === 'json'
								? t('export.downloading')
								: t('export.jsonAction')}
						</button>
					</div>
				</article>

				<article className="flex flex-col justify-between gap-6 rounded-box border border-base-300 bg-base-100 p-6">
					<div className="flex flex-col gap-3">
						<div className="flex items-center gap-2.5">
							<svg
								aria-hidden="true"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.75"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="h-5 w-5 shrink-0 text-base-content"
							>
								<rect x="3" y="3" width="18" height="18" rx="2" />
								<line x1="3" y1="9" x2="21" y2="9" />
								<line x1="3" y1="15" x2="21" y2="15" />
								<line x1="9" y1="9" x2="9" y2="21" />
							</svg>
							<h3 id="csv-export-heading" className="font-semibold">
								{t('export.csvTitle')}
							</h3>
						</div>
						<p className="text-sm text-[var(--color-slate)]">
							{t('export.csvDescription')}
						</p>
					</div>
					<form
						aria-labelledby="csv-export-heading"
						onSubmit={handleCsvSubmit}
						className="flex flex-col gap-4"
					>
						<Select
							label={t('export.sectionLabel')}
							name="section"
							value={section}
							onChange={(event) => setSection(event.target.value as ExportSection)}
							options={sectionOptions}
							disabled={activeFormat !== null}
						/>
						<div>
							<button
								type="submit"
								className="btn border-0 bg-base-200 hover:bg-base-300"
								disabled={activeFormat !== null}
							>
								{activeFormat === 'csv' && (
									<span
										className="loading loading-spinner loading-xs"
										aria-hidden="true"
									/>
								)}
								{activeFormat === 'csv'
									? t('export.downloading')
									: t('export.csvAction')}
							</button>
						</div>
					</form>
				</article>
			</div>
		</div>
	);
}
