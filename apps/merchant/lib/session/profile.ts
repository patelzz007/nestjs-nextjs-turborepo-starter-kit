"use client";

import { useAuth } from "@workspace/client/lib/auth";
import * as React from "react";

/** Shown for a signed-out shell (it renders only on auth routes' edges). */
const GUEST_DISPLAY_NAME = "Guest";

export interface MerchantSessionProfile {
	readonly fullName: string;
	readonly email: string;
	readonly isLoading: boolean;
}

/**
 * Name + email for the shell. Read from the auth feature's user — which is
 * already the live `/auth/me` profile (TanStack Query owns it inside the auth
 * provider) — so the shell adds no second `/auth/me` observer with its own
 * freshness and retry rules.
 */
export function useMerchantSessionProfile(): MerchantSessionProfile {
	const { user, isLoading } = useAuth();

	return React.useMemo(
		(): MerchantSessionProfile => ({
			fullName: user?.fullName ?? GUEST_DISPLAY_NAME,
			email: user?.email ?? "",
			isLoading: isLoading && user === null,
		}),
		[isLoading, user],
	);
}
