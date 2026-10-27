import { apiRequest } from '@services/api-client';

// /api/members: the people of the company that is open (the API client sends its X-Organization-Id).
export type Member = {
	userId: string;
	username: string;
	email: string;
	role: { code: string; name: string };
	isActive: boolean;
	lastLoginAt: string | null;
	mustChangePassword: boolean;
};
export type AssignableRole = { code: string; name: string; description: string | null };
export type NewMember = { username: string; email: string; password: string; roleCode: string };

export function listMembers() {
	return apiRequest<Member[]>('members');
}

export function listAssignableRoles() {
	return apiRequest<AssignableRole[]>('members/assignable-roles');
}

export function createMember(values: NewMember) {
	return apiRequest<Member>('members', { method: 'POST', body: JSON.stringify(values) });
}

export function setMemberActive({ userId, isActive }: { userId: string; isActive: boolean }) {
	return apiRequest<Member>(`members/${encodeURIComponent(userId)}`, {
		method: 'PATCH',
		body: JSON.stringify({ isActive }),
	});
}

// Applies on the person's next request (the API reads the membership's role every time).
export function changeMemberRole({ userId, roleCode }: { userId: string; roleCode: string }) {
	return apiRequest<Member>(`members/${encodeURIComponent(userId)}`, {
		method: 'PATCH',
		body: JSON.stringify({ roleCode }),
	});
}

// The answer is the one-time password: shown once, never stored.
export function resetMemberPassword(userId: string) {
	return apiRequest<{ temporaryPassword: string }>(
		`members/${encodeURIComponent(userId)}/password-reset`,
		{ method: 'POST' },
	);
}
