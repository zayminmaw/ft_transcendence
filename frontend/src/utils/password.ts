// The API's password rule (8-128 characters with a lower-case letter, an upper-case letter, a number and a symbol),
// checked in the browser too so the form can answer before sending.
export function meetsPasswordRule(password: string): boolean {
	return (
		password.length >= 8 &&
		password.length <= 128 &&
		/[a-z]/.test(password) &&
		/[A-Z]/.test(password) &&
		/[0-9]/.test(password) &&
		/[^A-Za-z0-9]/.test(password)
	);
}

// No look-alikes (0/O, 1/l/I), so it can be read out or typed by hand: the same kind as the API's one-time passwords.
const PASSWORD_SETS = [
	'ABCDEFGHJKLMNPQRSTUVWXYZ',
	'abcdefghijkmnopqrstuvwxyz',
	'23456789',
	'!#$%&*+-=?@',
];

// A random whole number below `size`, without the bias a plain modulo would add.
function randomIndex(size: number): number {
	const limit = Math.floor(0x100000000 / size) * size;
	const value = new Uint32Array(1);
	do {
		crypto.getRandomValues(value);
	} while (value[0] >= limit);
	return value[0] % size;
}

// 16 characters with at least one from each set, shuffled, so it always passes the rule.
export function generatePassword(): string {
	const all = PASSWORD_SETS.join('');
	const characters = PASSWORD_SETS.map((set) => set[randomIndex(set.length)]);
	while (characters.length < 16) characters.push(all[randomIndex(all.length)]);
	for (let i = characters.length - 1; i > 0; i--) {
		const j = randomIndex(i + 1);
		[characters[i], characters[j]] = [characters[j], characters[i]];
	}
	return characters.join('');
}
