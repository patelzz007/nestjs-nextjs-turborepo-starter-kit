"use client";

import { isMerchantAuthPath } from "@/lib/auth/routes";
import { ClientAuthWrapper } from "@workspace/client/lib/auth/session/client-auth-wrapper";
import { usePathname } from "next/navigation";
import * as React from "react";

const MERCHANT_COOKIE_NAMES = {
	accessToken: "merchantAccessToken",
	refreshToken: "merchantRefreshToken",
};

export interface MerchantRootProviderProps {
	readonly children: React.ReactNode;
}

/**
 * Merchant portal root — session only. The active organization is not held
 * here: the `/orgs/[orgSlug]` URL owns it (`useOrganizationSlug`), and the
 * org layout's `OrgTenantBootstrap` is the one writer of the
 * `organizationSlug` preference cookie.
 */
export function MerchantRootProvider({ children }: MerchantRootProviderProps): React.JSX.Element {
	const pathname = usePathname();

	const shouldRedirectOnUnauthorized = React.useCallback((): boolean => {
		return !isMerchantAuthPath(pathname);
	}, [pathname]);

	const revalidateSessionEnabled = !isMerchantAuthPath(pathname);

	return (
		<ClientAuthWrapper
			cookieNames={MERCHANT_COOKIE_NAMES}
			clientType="merchant"
			shouldRedirectOnUnauthorized={shouldRedirectOnUnauthorized}
			revalidateSessionEnabled={revalidateSessionEnabled}>
			{children}
		</ClientAuthWrapper>
	);
}
