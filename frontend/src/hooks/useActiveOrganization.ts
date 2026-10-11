import { queryClient } from '@app/store/query-client';
import { sessionStore } from '@app/store/session';
import { useAuth } from './useAuth';

export async function setActiveOrganization(organizationId: string | null) {
  await queryClient.cancelQueries();
  queryClient.clear();
  sessionStore.setSession({ ...sessionStore.getSnapshot(), activeOrganizationId: organizationId });
}

export function useActiveOrganization() {
  return { activeOrganizationId: useAuth().activeOrganizationId, setActiveOrganization };
}
