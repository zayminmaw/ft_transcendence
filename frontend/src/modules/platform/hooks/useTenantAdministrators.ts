import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@services/api-client';
import { tenantsQueryKey } from '@utils/query-keys';
import type { MemberRole, TenantMember } from '../api';

// Members who could become administrators, for the "Existing member" choice. Under the tenant key, so assigning
// and revoking refresh it.
export function useTenantMembers(tenantId: string, search: string, enabled: boolean) {
	const { data, isPending, isError } = useQuery({
		queryKey: [...tenantsQueryKey(), 'members', tenantId, search],
		queryFn: () => {
			const query = new URLSearchParams();
			if (search.trim()) query.set('search', search.trim());
			return apiRequest<TenantMember[]>(
				`platform/tenants/${encodeURIComponent(tenantId)}/members?${query}`,
			);
		},
		// The last list stays while the next search loads, so the rows do not flash empty on every keystroke.
		placeholderData: keepPreviousData,
		enabled,
	});
	return { members: data ?? [], isMembersPending: isPending, isMembersError: isError };
}

// The roles a revoked administrator can keep working with in this company.
export function useMemberRoles(tenantId: string, enabled: boolean) {
	const { data, isPending } = useQuery({
		queryKey: [...tenantsQueryKey(), 'member-roles', tenantId],
		queryFn: () =>
			apiRequest<MemberRole[]>(
				`platform/tenants/${encodeURIComponent(tenantId)}/member-roles`,
			),
		enabled,
	});
	return { roles: data ?? [], isRolesPending: isPending };
}
