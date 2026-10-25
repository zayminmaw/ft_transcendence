import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@services/api-client';
import { platformQueryKey, tenantsQueryKey } from '@utils/query-keys';
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
		enabled,
	});
	return { members: data ?? [], isMembersPending: isPending, isMembersError: isError };
}

// The company roles a revoked administrator can keep working with. Reference data: it rarely changes.
export function useMemberRoles(enabled: boolean) {
	const { data, isPending } = useQuery({
		queryKey: platformQueryKey('member-roles'),
		queryFn: () => apiRequest<MemberRole[]>('platform/member-roles'),
		staleTime: Infinity,
		enabled,
	});
	return { roles: data ?? [], isRolesPending: isPending };
}
