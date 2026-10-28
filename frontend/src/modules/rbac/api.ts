import { apiRequest } from '@services/api-client';

// /api/members: the people of the company that is open (the API client sends its X-Organization-Id).
export type Member = {
	userId: string;
	username: string;
	email: string;
	// The name the person chose on their profile; null shows the username.
	displayName: string | null;
	role: { code: string; name: string };
	isActive: boolean;
	lastLoginAt: string | null;
	mustChangePassword: boolean;
};
export type AssignableRole = { code: string; name: string; description: string | null };
export type NewMember = { username: string; email: string; password: string; roleCode: string };
// /api/members/roles: what each company role allows (read-only; roles are shared by every company) and how many people
// hold it in this one. scope "assigned_only" means only their own records.
export type RoleOverview = {
	code: string;
	name: string;
	members: number;
	permissions: { code: string; scope: 'all' | 'assigned_only' }[];
};

export function listMembers() {
	return apiRequest<Member[]>('members');
}

export function listRoleOverview() {
	return apiRequest<RoleOverview[]>('members/roles');
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
