// Fragments are not sent to the web server or in Referer headers. The preview API also sends the token in its body.
export function createInviteUrl(origin: string, token: string): string {
	const url = new URL('/signup', origin);
	url.hash = new URLSearchParams({ token }).toString();
	return url.href;
}

export function inviteTokenFromHash(hash: string): string {
	return new URLSearchParams(hash.replace(/^#/, '')).get('token')?.trim() ?? '';
}
