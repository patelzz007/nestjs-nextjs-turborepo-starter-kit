"use client";

import { clearAllOrganizationLocationCookies } from "@/lib/org/location";
import { clearOrganizationSlugCookie } from "@/lib/org/slug";
import { useAuth } from "@workspace/client/lib/auth";
import * as React from "react";

/** Drops the portal's per-browser preferences (last organization, store per organization) — nothing of one member carries over to the next sign-in. */
export function clearMerchantPreferenceCookies(): void {
	clearOrganizationSlugCookie();
	clearAllOrganizationLocationCookies();
}

/**
 * Sign-out for the merchant portal: clears the preference cookies first, then
 * ends the session (`useAuth().logout` clears the session cookies and
 * redirects). Every sign-out control uses this, so none forgets the preferences.
 */
export function useMerchantLogout(): () => Promise<void> {
	const { logout } = useAuth();
	return React.useCallback(async (): Promise<void> => {
		clearMerchantPreferenceCookies();
		await logout();
	}, [logout]);
}
