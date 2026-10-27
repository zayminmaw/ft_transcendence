// Turns a name into a URL slug: "Meridian Courier" → "meridian-courier". Lower-case letters and numbers joined by
// single dashes, at most 64 characters (the length company slugs allow).
export function toSlug(name: string) {
	return name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64)
		.replace(/-+$/, '');
}
