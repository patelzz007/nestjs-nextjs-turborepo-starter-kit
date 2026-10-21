"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { ImpersonationBannerBar } from "@workspace/client/lib/contexts/identity/impersonation/impersonation-banner-bar";
import type * as React from "react";

export interface ImpersonationBannerProps {
	/** Decoded server-side from the merchant JWT so the banner paints in SSR HTML. */
	readonly initialIsImpersonating?: boolean;
}

/** Banner shown while a super-admin impersonates another user in the merchant portal. */
export function ImpersonationBanner({ initialIsImpersonating = false }: ImpersonationBannerProps): React.JSX.Element | null {
	const { api } = useAuth();
	const permissionsQuery = api.auth.permissions.useQuery(undefined, { retry: 1 });

	const session = permissionsQuery.data?.data;
	const isImpersonating = permissionsQuery.isFetched ? session?.isImpersonating === true : initialIsImpersonating;

	if (!isImpersonating) {
		return null;
	}

	return <ImpersonationBannerBar message="Impersonation active — merchant actions run as the impersonated account." />;
}
