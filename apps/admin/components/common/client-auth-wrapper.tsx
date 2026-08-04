// ============================================
// components/client-auth-wrapper.tsx
// Bridges next/navigation useRouter to AuthProvider
// ============================================
"use client";

import { AuthProvider, type AuthProviderProps } from "@workspace/client/lib/auth";
import { useRouter } from "next/navigation";
import { useCallback, type JSX } from "react";

export interface ClientAuthWrapperProps {
	readonly children: React.ReactNode;
}

/**
 * Bridges `next/navigation` `useRouter` into the shared `AuthProvider`.
 * The admin app only has one auth redirect target, so it is hardcoded here
 * rather than threaded through props nobody overrides.
 */
export function ClientAuthWrapper({ children }: ClientAuthWrapperProps): JSX.Element {
	const router = useRouter();

	const navigate = useCallback(
		(url: string): void => {
			router.push(url);
		},
		[router],
	);

	const refresh = useCallback((): void => {
		router.refresh();
	}, [router]);

	const authProps: AuthProviderProps = {
		children,
		onUnauthorizedRedirect: "/auth/login",
		navigate,
		refresh,
		// Use isolated cookie names for the admin panel so that web app
		// cookies are not shared with the admin app on the same host.
		cookieNames: {
			accessToken: "adminAccessToken",
			refreshToken: "adminRefreshToken",
		},
		// Send X-Client-Type: admin on logout so the backend only clears
		// the admin cookie set, not the web cookies.
		clientType: "admin",
	};

	return <AuthProvider {...authProps} />;
}
