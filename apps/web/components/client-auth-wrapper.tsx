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
	readonly redirectPath?: string;
}

export function ClientAuthWrapper({ children, redirectPath = "/auth/login" }: ClientAuthWrapperProps): JSX.Element {
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
		onUnauthorizedRedirect: redirectPath,
		navigate,
		refresh,
	};

	return <AuthProvider {...authProps} />;
}
