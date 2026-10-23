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
