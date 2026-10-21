"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { ImpersonationBannerBar } from "@workspace/client/lib/contexts/identity/impersonation/impersonation-banner-bar";
import { APP_LINKS } from "@workspace/shared";
import type * as React from "react";

import { clientEnv } from "@/lib/env/env.client";

/** The other portals, opened in a new tab to see the impersonated account there. */
function PortalLinks(): React.JSX.Element {
	return (
		<>
			<a href={`${clientEnv.NEXT_PUBLIC_WEB_URL}${APP_LINKS.web.dashboard}`} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">
				Consumer portal
			</a>
			<a href={clientEnv.NEXT_PUBLIC_MERCHANT_URL} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">
				Merchant portal
			</a>
		</>
	);
}

/** Banner shown while a super-admin is impersonating another user. */
export function ImpersonationBanner(): React.JSX.Element | null {
	const { api } = useAuth();
	const permissionsQuery = api.auth.permissions.useQuery(undefined, { retry: 1 });

	if (permissionsQuery.data?.data.isImpersonating !== true) {
		return null;
	}

	return <ImpersonationBannerBar message="You are impersonating another user. Actions run as the impersonated account." links={<PortalLinks />} />;
}
