import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { sessionStore } from '@app/store/session';
import { useAuth } from '@hooks/useAuth';
import { logOut } from '@services/session-refresh';
import { changePassword, fetchMe, logIn, type Me, updateProfile } from './api';

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

// The name to show for someone: the display name they chose, else their username.
export function shownName(person: { username: string; displayName: string | null }) {
	return person.displayName ?? person.username;
}

// The company named in the URL, when it is one of yours.
export function useCurrentWorkspace() {
	const { companySlug } = useParams();
	return useMe().data?.workspaces.find(({ slug }) => slug === companySlug);
}

// A role's name in the current language, by its code (common.json "roles"); a code without a translation keeps the
// database's English name.
export function useRoleName() {
	const { t, i18n } = useTranslation();
	return (role: { code: string; name: string }) => {
		const key = `roles.${role.code}`;
		return i18n.exists(key) ? t(key as ParseKeys<'common'>) : role.name;
	};
}

// What your role allows in the open company: can('billing.view'). Only decides what to show; the API decides what
// happens.
export function useCan() {
	const permissions = useCurrentWorkspace()?.permissions;
	return (code: string) => permissions?.includes(code) === true;
}

export function useLogin() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	return useMutation({
		mutationFn: logIn,
		// The variables are the typed password: don't keep them once the login page is gone.
		gcTime: 0,
		onSuccess: ({ accessToken, user }) => {
			queryClient.removeQueries();
			sessionStore.start(accessToken, user.id);
			navigate('/app', { replace: true });
		},
	});
}

// Keeps this session with the new token (the same user, so the open company stays) and clears the flag in the cached
// /me, so the change page and the guard let the account through at once.
export function useChangePassword() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: changePassword,
		// The variables are passwords: don't keep them once the page is gone.
		gcTime: 0,
		onSuccess: ({ accessToken }) => {
			const { userId } = sessionStore.getSnapshot();
			if (!userId) return;
			sessionStore.start(accessToken, userId);
			queryClient.setQueryData<Me>(
				['auth', 'me', userId],
				(me) => me && { ...me, mustChangePassword: false },
			);
		},
	});
}

// Saves your display name and puts the answer in the cached /me, so the card and the page show it at once.
export function useUpdateProfile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: updateProfile,
		onSuccess: ({ user }) => {
			queryClient.setQueryData<Me>(
				['auth', 'me', sessionStore.getSnapshot().userId],
				(me) => me && { ...me, user },
			);
		},
	});
}

// Ending the session sends the guards back to /login.
export function useLogout() {
	return useMutation({ mutationFn: logOut });
}
