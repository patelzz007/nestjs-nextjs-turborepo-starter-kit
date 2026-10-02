"use client";

import { isWebAuthPath, isWebGuestBrowsablePath } from "@/lib/auth/routes";
import { ClientAuthWrapper } from "@workspace/client/lib/auth/session/client-auth-wrapper";
import { usePathname } from "next/navigation";
import { useCallback, type JSX, type ReactNode } from "react";

export interface WebClientAuthWrapperProps {
	/** The server saw a session cookie on this request (`hasServerSession`). */
	readonly sessionActive: boolean;
	readonly children: ReactNode;
}

/** Web auth bridge — skips login redirect on guest-browsable routes (e.g. `/`). */
export function WebClientAuthWrapper({ sessionActive, children }: WebClientAuthWrapperProps): JSX.Element {
	const pathname = usePathname();

	const shouldRedirectOnUnauthorized = useCallback((): boolean => {
		return !isWebGuestBrowsablePath(pathname);
	}, [pathname]);

	const revalidateSessionEnabled = !isWebAuthPath(pathname);

	// `sessionHint`: a guest (no session cookie on the server) skips the on-mount
	// `/auth/me` + `/auth/permissions` round trip that could only answer 401.
	return (
		<ClientAuthWrapper shouldRedirectOnUnauthorized={shouldRedirectOnUnauthorized} revalidateSessionEnabled={revalidateSessionEnabled} sessionHint={sessionActive}>
			{children}
		</ClientAuthWrapper>
	);
}
