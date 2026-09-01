// ============================================
// packages/client/src/lib/client-auth-wrapper.tsx
// Shared Next.js auth bridge for BOTH apps.
//
// Previously duplicated in apps/web and apps/admin with ~25 identical lines
// (useRouter → navigate/refresh) differing only by cookie names + client type
// (point 5 of the folder-structure pass — see docs/architecture.md §5).
// ============================================
"use client";

import { useRouter } from "next/navigation";
import { useCallback, type JSX, type ReactNode } from "react";

import { AuthProvider, type CookieNamesConfig } from "./index";

export interface ClientAuthWrapperProps {
	readonly children: ReactNode;
	/**
	 * Where unauthenticated users are redirected (client-side) when an API
	 * call 401s. @default "/auth/login"
	 */
	readonly redirectPath?: string;
	/**
	 * Cookie names used to determine auth state. Defaults to the web app's
	 * `accessToken` / `refreshToken`; the admin panel passes its isolated
	 * `adminAccessToken` / `adminRefreshToken` pair.
	 */
	readonly cookieNames?: CookieNamesConfig;
	/**
	 * Client type sent on logout (`X-Client-Type: admin`) so the backend only
	 * clears the matching cookie set. @default "web"
	 */
	readonly clientType?: "web" | "admin" | "merchant";
	/** Extra headers merged into every API call (e.g. merchant org context). */
	readonly extraHeaders?: Record<string, string>;
	/**
	 * When a 401 invalidates the session, navigation to `redirectPath` only
	 * happens if this returns true. Defaults to always redirect.
	 */
	readonly shouldRedirectOnUnauthorized?: () => boolean;
}

export function ClientAuthWrapper({
	children,
	redirectPath = "/auth/login",
	cookieNames,
	clientType,
	extraHeaders,
	shouldRedirectOnUnauthorized,
}: ClientAuthWrapperProps): JSX.Element {
	const router = useRouter();

	const navigate = useCallback(
		(url: string): void => {
			router.replace(url);
		},
		[router],
	);

	const refresh = useCallback((): void => {
		router.refresh();
	}, [router]);

	return (
		<AuthProvider
			children={children}
			onUnauthorizedRedirect={redirectPath}
			navigate={navigate}
			refresh={refresh}
			cookieNames={cookieNames}
			clientType={clientType}
			extraHeaders={extraHeaders}
			shouldRedirectOnUnauthorized={shouldRedirectOnUnauthorized}
		/>
	);
}
