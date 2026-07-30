// ============================================
// components/client-auth-wrapper.tsx
// Bridges next/navigation useRouter to AuthProvider
// ============================================
"use client";

import { useRouter } from "next/navigation";
import { AuthProvider, type AuthProviderProps } from "@workspace/ui/lib/auth";
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
		baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
		onUnauthorizedRedirect: redirectPath,
		navigate,
		refresh,
	};

	return <AuthProvider {...authProps} />;
}
