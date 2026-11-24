import type { ReactNode } from 'react';

// One labelled value in a details list (inside a <dl>), with an optional smaller note under it.
export function DetailItem({
	label,
	children,
	note,
	ltr = false,
	valueClassName = 'font-medium',
}: {
	label: string;
	children: ReactNode;
	note?: ReactNode;
	// Phone numbers, emails, amounts and coordinates read left to right, also on an Arabic page.
	ltr?: boolean;
	valueClassName?: string;
}) {
	return (
		<div className="min-w-0">
			<dt className="text-sm text-[var(--color-slate)]">{label}</dt>
			{/* dir sits on an inner span, so the value stays next to its label on an Arabic page. */}
			<dd className={`mt-1 break-words ${valueClassName}`}>
				{ltr ? <span dir="ltr">{children}</span> : children}
			</dd>
			{note && <dd className="mt-1 text-xs text-[var(--color-slate)]">{note}</dd>}
		</div>
	);
}
