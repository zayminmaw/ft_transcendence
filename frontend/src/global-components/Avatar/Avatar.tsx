import { useState } from 'react';

// Someone's picture: the one they uploaded, else their initials on a colour picked from their username, so it stays the
// same everywhere and never changes. aria-hidden: the name is always written next to it.
const COLORS = [
	'bg-primary text-primary-content',
	'bg-accent text-accent-content',
	'bg-info text-info-content',
	'bg-success text-success-content',
	'bg-warning text-warning-content',
	'bg-neutral text-neutral-content',
];
// sm fits beside a name in the sidebar card; lg heads the profile page.
const SIZES = { sm: 'size-6 text-[0.625rem]', lg: 'size-20 text-2xl' };

export function Avatar({
	name,
	seed,
	src = null,
	size = 'sm',
}: {
	name: string;
	seed: string;
	// A signed link to the uploaded picture; null shows the initials.
	src?: string | null;
	size?: keyof typeof SIZES;
}) {
	// A link that stops working (it expired, or the picture was removed) shows the initials until a new link comes.
	const [failed, setFailed] = useState<string | null>(null);
	if (src && src !== failed)
		return (
			<img
				src={src}
				alt=""
				aria-hidden="true"
				className={`shrink-0 rounded-full object-cover ${SIZES[size]}`}
				onError={() => setFailed(src)}
			/>
		);
	return (
		<span
			aria-hidden="true"
			className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZES[size]} ${COLORS[colorIndex(seed)]}`}
		>
			{initials(name)}
		</span>
	);
}

// The first letter of the first two words ("Noor Haddad" → "NH", "noor" → "N"). Letters are whole graphemes, so a
// Thai letter keeps its marks.
function initials(name: string): string {
	const letters = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((word) => letters.segment(word)[Symbol.iterator]().next().value?.segment ?? '')
		.join('')
		.toLocaleUpperCase();
}

function colorIndex(seed: string): number {
	let sum = 0;
	for (const character of seed) sum += character.codePointAt(0) ?? 0;
	return sum % COLORS.length;
}
