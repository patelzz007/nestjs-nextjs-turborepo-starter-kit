"use client";

import { useAuth } from "./index";
import { toAuthUser } from "./map-auth-user";
import * as React from "react";

/**
 * Keeps the auth store aligned with `/auth/me` and JWT-aligned `/auth/permissions`.
 */
export function AuthSessionBootstrap(): null {
	const { user, login, api, sessionRevalidationEnabled } = useAuth();
	const sessionSyncEnabled = user !== null && sessionRevalidationEnabled;

	const meQuery = api.auth.me.useQuery(undefined, {
		enabled: sessionSyncEnabled,
		retry: false,
		staleTime: 60_000,
	});

	const permissionsQuery = api.auth.permissions.useQuery(undefined, {
		enabled: sessionSyncEnabled,
		retry: false,
		staleTime: 60_000,
	});

	React.useEffect((): void => {
		const profile = meQuery.data?.data;
		const session = permissionsQuery.data?.data;
		if (profile === undefined || session === undefined) {
			return;
		}

		const nextUser = toAuthUser(profile, session);
		if (
			user?.id === nextUser.id &&
			user.isEmailVerified === nextUser.isEmailVerified &&
			user.sessionScope === nextUser.sessionScope &&
			user.enrollmentReason === nextUser.enrollmentReason
		) {
			return;
		}

		login(nextUser);
	}, [login, meQuery.data?.data, permissionsQuery.data?.data, user?.enrollmentReason, user?.id, user?.isEmailVerified, user?.sessionScope]);

	return null;
}
