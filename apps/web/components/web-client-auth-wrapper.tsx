"use client";

import { isWebGuestBrowsablePath } from "@/lib/auth-routes";
import { ClientAuthWrapper } from "@workspace/client/lib/auth/client-auth-wrapper";
import { usePathname } from "next/navigation";
import { useCallback, type JSX, type ReactNode } from "react";

export interface WebClientAuthWrapperProps {
	readonly children: ReactNode;
}

/** Web auth bridge — skips login redirect on guest-browsable routes (e.g. `/`). */
export function WebClientAuthWrapper({ children }: WebClientAuthWrapperProps): JSX.Element {
	const pathname = usePathname();

	const shouldRedirectOnUnauthorized = useCallback((): boolean => {
		return !isWebGuestBrowsablePath(pathname);
	}, [pathname]);

	return <ClientAuthWrapper shouldRedirectOnUnauthorized={shouldRedirectOnUnauthorized}>{children}</ClientAuthWrapper>;
}
