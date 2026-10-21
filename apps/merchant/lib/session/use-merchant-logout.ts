"use client";

import { clearAllLocationCookies } from "@/contexts/tenancy/lib/tenant/location";
import { clearTenantSlugCookie } from "@/contexts/tenancy/lib/tenant/slug";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import * as React from "react";

/** Drops the portal's per-browser preferences (last tenant, store per tenant) — nothing of one member carries over to the next sign-in. */
export function clearMerchantPreferenceCookies(): void {
	clearTenantSlugCookie();
	clearAllLocationCookies();
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
