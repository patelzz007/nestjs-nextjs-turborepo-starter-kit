"use client";

import { toAuthUser } from "@/lib/map-auth-user";
import { useAuth } from "@workspace/client/lib/auth";
import * as React from "react";

/**
 * Keeps the persisted auth store aligned with the httpOnly cookie session.
 * Required after impersonation so the sidebar shows the impersonated user.
 */
export function MerchantSessionBootstrap(): null {
	const { user, login, api, sessionRevalidationEnabled } = useAuth();
	const sessionSyncEnabled = user !== null && sessionRevalidationEnabled;

	const meQuery = api.auth.me.useQuery(undefined, {
		enabled: sessionSyncEnabled,
		retry: false,
		staleTime: 60_000,
	});

	React.useEffect((): void => {
		const profile = meQuery.data?.data;
		if (profile === undefined) {
			return;
		}
		if (user?.id === profile.id && user.isEmailVerified === profile.isEmailVerified) {
			return;
		}
		login(toAuthUser(profile));
	}, [login, meQuery.data?.data, user?.id, user?.isEmailVerified]);

	return null;
}
