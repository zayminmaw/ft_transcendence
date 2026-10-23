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

export function listMembers() {
	return apiRequest<Member[]>('members');
}
