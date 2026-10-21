"use client";

import { useWebSession } from "@/contexts/identity/components/web-authorization-provider";
import { ImpersonationBannerBar } from "@workspace/client/lib/contexts/identity/impersonation/impersonation-banner-bar";
import type * as React from "react";

/**
 * Banner shown while a super-admin is impersonating another user (web app).
 * `POST /auth/stop-impersonation` needs no permission (any impersonation
 * session may end itself), so the banner is gated only on the session flag.
 */
export function ImpersonationBanner(): React.JSX.Element | null {
	const { session } = useWebSession();

	if (session?.isImpersonating !== true) {
		return null;
	}

	return <ImpersonationBannerBar message="You are impersonating another user. The web app runs as that account." />;
}
