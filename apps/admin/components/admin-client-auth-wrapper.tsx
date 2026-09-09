"use client";

import { isAdminAuthPath } from "@/lib/auth-routes";
import { ClientAuthWrapper } from "@workspace/client/lib/auth/client-auth-wrapper";
import { usePathname } from "next/navigation";
import { useCallback, type JSX, type ReactNode } from "react";

export interface AdminClientAuthWrapperProps {
	readonly children: ReactNode;
}

/** Admin auth bridge — skips `/auth/me` on login / password-reset / verify-email routes. */
export function AdminClientAuthWrapper({ children }: AdminClientAuthWrapperProps): JSX.Element {
	const pathname = usePathname();

	const shouldRedirectOnUnauthorized = useCallback((): boolean => {
		return !isAdminAuthPath(pathname);
	}, [pathname]);

	const revalidateSessionEnabled = !isAdminAuthPath(pathname);

	return (
		<ClientAuthWrapper
			cookieNames={{ accessToken: "adminAccessToken", refreshToken: "adminRefreshToken" }}
			clientType="admin"
			shouldRedirectOnUnauthorized={shouldRedirectOnUnauthorized}
			revalidateSessionEnabled={revalidateSessionEnabled}>
			{children}
		</ClientAuthWrapper>
	);
}
