import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@services/api-client';
import { tenantQueryKey } from '@utils/query-keys';
import { createMember, listAssignableRoles, listMembers } from './api';

// A refusal (403 without user management, 404) won't change on a second try; a network or server error might.
const retryServerErrors = (failures: number, error: unknown) =>
	failures < 1 && !(error instanceof ApiError && error.status < 500);

export function useMembers() {
	return useQuery({
		queryKey: tenantQueryKey('members'),
		queryFn: listMembers,
		retry: retryServerErrors,
	});
}

export function useAssignableRoles() {
	return useQuery({
		queryKey: tenantQueryKey('members', 'assignable-roles'),
		queryFn: listAssignableRoles,
		retry: retryServerErrors,
	});
}

function useReloadMembers() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: tenantQueryKey('members') });
}

export function useCreateMember() {
	const reload = useReloadMembers();
	return useMutation({
		mutationFn: createMember,
		// The variables hold the initial password: don't keep them once the page is gone.
		gcTime: 0,
		onSuccess: reload,
	});
}
