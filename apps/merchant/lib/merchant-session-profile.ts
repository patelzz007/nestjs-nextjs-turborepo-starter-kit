"use client";

import { useAuth } from "@workspace/client/lib/auth";
import * as React from "react";

export interface MerchantSessionProfile {
	readonly fullName: string;
	readonly email: string;
	readonly isLoading: boolean;
}

/** Prefer live `/auth/me` over the persisted auth store (stale after impersonation). */
export function useMerchantSessionProfile(): MerchantSessionProfile {
	const { user, api } = useAuth();

	const meQuery = api.auth.me.useQuery(undefined, {
		enabled: user !== null,
		retry: false,
	});

	const profile = meQuery.data?.data;

	return React.useMemo(
		(): MerchantSessionProfile => ({
			fullName: profile?.fullName ?? user?.fullName ?? "Guest",
			email: profile?.email ?? user?.email ?? "",
			isLoading: user !== null && meQuery.isLoading && profile === undefined,
		}),
		[meQuery.isLoading, profile, user],
	);
}
