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
