import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { retryServerErrors } from '@services/api-client';
import { tenantQueryKey } from '@utils/query-keys';
import {
	changeMemberRole,
	createInvite,
	createMember,
	listAssignableRoles,
	listInvites,
	listMembers,
	listRoleOverview,
	resetMemberPassword,
	revokeInvite,
	setMemberActive,
} from './api';

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

export function useRoleOverview() {
	return useQuery({
		queryKey: tenantQueryKey('members', 'roles'),
		queryFn: listRoleOverview,
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

export function useSetMemberActive() {
	const reload = useReloadMembers();
	// A refusal (someone else changed this person meanwhile) reloads the list too.
	return useMutation({ mutationFn: setMemberActive, onSettled: reload });
}

export function useChangeMemberRole() {
	const reload = useReloadMembers();
	return useMutation({ mutationFn: changeMemberRole, onSettled: reload });
}

export function useResetMemberPassword() {
	const reload = useReloadMembers();
	return useMutation({
		mutationFn: resetMemberPassword,
		// The answer is the one-time password: the dialog shows it, the cache never keeps it.
		gcTime: 0,
		onSettled: reload,
	});
}

export function useInvites() {
	return useQuery({
		queryKey: tenantQueryKey('members', 'invites'),
		queryFn: listInvites,
		retry: retryServerErrors,
	});
}

export function useCreateInvite() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createInvite,
		// The answer includes the one-time invite token: don't retain it in query cache.
		gcTime: 0,
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: tenantQueryKey('members', 'invites') }),
	});
}

export function useRevokeInvite() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: revokeInvite,
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: tenantQueryKey('members', 'invites') }),
	});
}
