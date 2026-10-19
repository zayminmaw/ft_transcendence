import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { sessionStore } from '@app/store/session';
import { useAuth } from '@hooks/useAuth';
import { logOut } from '@services/session-refresh';
import { fetchMe, logIn } from './api';

// The account, its companies and platform access. The picker passes refetchOnMount: 'always', so a removed
// membership disappears when it opens.
export function useMe(options: { refetchOnMount?: 'always' } = {}) {
	const { userId } = useAuth();
	return useQuery({
		queryKey: ['auth', 'me', userId],
		queryFn: fetchMe,
		enabled: userId !== null,
		...options,
	});
}

// The company named in the URL, when it is one of yours.
export function useCurrentWorkspace() {
	const { companySlug } = useParams();
	return useMe().data?.workspaces.find(({ slug }) => slug === companySlug);
}

export function useLogin() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	return useMutation({
		mutationFn: logIn,
		onSuccess: ({ accessToken, user }) => {
			queryClient.removeQueries();
			sessionStore.start(accessToken, user.id);
			navigate('/app', { replace: true });
		},
	});
}

// Ending the session sends the guards back to /login.
export function useLogout() {
	return useMutation({ mutationFn: logOut });
}
