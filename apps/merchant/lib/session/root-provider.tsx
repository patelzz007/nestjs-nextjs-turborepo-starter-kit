"use client";

import { isMerchantAuthPath } from "@/contexts/identity/lib/routes";
import type { ServerRenderedSession } from "@workspace/client/lib/contexts/identity";
import { ClientAuthWrapper } from "@workspace/client/lib/contexts/identity/session/client-auth-wrapper";
import { usePathname } from "next/navigation";
import * as React from "react";

import { createRequestScopeHolder, requestScopeHeaders, RequestScopeProvider } from "./request-scope";

export interface MerchantRootProviderProps {
	readonly children: React.ReactNode;
	/** The session the server rendered the page for; the auth store starts from it. */
	readonly serverSession?: ServerRenderedSession | undefined;
}

/**
 * Merchant portal root — session only. The active tenant is not held
 * here: the `/t/[tenantSlug]` URL owns it (`useTenantSlug`), and the
 * tenant layout's `TenantBootstrap` is the one writer of the
 * `tenantSlug` preference cookie. It does own the request scope holder: every
 * API call reads the open tenant and chosen store from it (`X-Tenant-Id`,
 * `X-Location-Id`), and the tenant layout's context provider writes it.
 */
export function MerchantRootProvider({ children, serverSession }: MerchantRootProviderProps): React.JSX.Element {
	const pathname = usePathname();

	const shouldRedirectOnUnauthorized = React.useCallback((): boolean => {
		return !isMerchantAuthPath(pathname);
	}, [pathname]);

	const revalidateSessionEnabled = !isMerchantAuthPath(pathname);

	// One holder per mount; the header reader keeps its identity, so the API client is built once.
	const [scopeHolder] = React.useState(createRequestScopeHolder);
	const requestHeaders = React.useCallback((): Readonly<Record<string, string>> => requestScopeHeaders(scopeHolder.read()), [scopeHolder]);

	return (
		<RequestScopeProvider value={scopeHolder}>
			<ClientAuthWrapper
				clientType="merchant"
				shouldRedirectOnUnauthorized={shouldRedirectOnUnauthorized}
				revalidateSessionEnabled={revalidateSessionEnabled}
				serverSession={serverSession}
				requestHeaders={requestHeaders}>
				{children}
			</ClientAuthWrapper>
		</RequestScopeProvider>
	);
}
