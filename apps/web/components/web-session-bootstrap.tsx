"use client";

import { toAuthUser } from "@/lib/map-auth-user";
import { useAuth } from "@workspace/client/lib/auth";
import * as React from "react";

/**
 * Reconciles persisted client auth state with the real httpOnly cookie session.
 *
 * Zustand persists the user to localStorage after login, but cookies can be
 * missing (cleared by the proxy, wrong `COOKIE_DOMAIN`, or a different port).
 * Without this check the UI can look "logged in" while no session exists.
 */
export function WebSessionBootstrap(): null {
	const { user, login, api, sessionRevalidationEnabled } = useAuth();
	const sessionSyncEnabled = user !== null && sessionRevalidationEnabled;

	const meQuery = api.auth.me.useQuery(undefined, {
		enabled: sessionSyncEnabled,
		retry: false,
	});

	React.useEffect((): void => {
		const profile = meQuery.data?.data;
		if (profile === undefined) {
			return;
		}
		login(toAuthUser(profile));
	}, [login, meQuery.data?.data]);

	// A 401 is handled by AuthProvider → invalidateSession → clearUser.
	return null;
}
