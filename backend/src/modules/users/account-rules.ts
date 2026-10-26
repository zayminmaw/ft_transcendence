// The shape of a username and login email, shared by every place that creates an account.
export const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 191;

export const USERNAME_RULE = 'Username: 3-64 letters, numbers, dots, dashes or underscores.';
export const EMAIL_RULE = 'Email: enter a valid address.';
export const PASSWORD_RULE = 'Password: 8-128 characters with an upper-case letter, a lower-case letter, a number and a symbol.';
