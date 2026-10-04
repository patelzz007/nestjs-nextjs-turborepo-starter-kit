// ============================================
// packages/client/src/lib/auth/session/client-auth-wrapper.tsx
// The Next.js bridge of the auth provider, shared by every app: it turns
// "leave the session's pages" into App Router navigation.
// ============================================
"use client";

import type { AuthClientType } from "@workspace/shared";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type JSX, type ReactNode } from "react";

import { AuthProvider } from "../index";

export interface ClientAuthWrapperProps {
	readonly children: ReactNode;
	/**
	 * Where unauthenticated users are redirected (client-side) when an API
	 * call 401s. @default "/auth/login"
	 */
	readonly redirectPath?: string | undefined;
	/** Which frontend this is — picks its isolated cookie set and cross-tab channel. */
	readonly clientType: AuthClientType;
	/**
	 * When a 401 invalidates the session, navigation to `redirectPath` only
	 * happens if this returns true. Defaults to always redirect.
	 */
	readonly shouldRedirectOnUnauthorized?: (() => boolean) | undefined;
	/** Skip `GET /auth/me` on mount when false (auth / onboarding routes). @default true */
	readonly revalidateSessionEnabled?: boolean | undefined;
	/** Did the server see a session cookie? `false` skips only the on-mount revalidation (a guest has nothing to restore). @default true */
	readonly sessionHint?: boolean | undefined;
}

/** The pathname part of an app-relative URL (`/auth/login?redirect=…` → `/auth/login`). */
function pathnameOf(url: string): string {
	const queryStart: number = url.search(/[?#]/);
	return queryStart === -1 ? url : url.slice(0, queryStart);
}

export function ClientAuthWrapper({
	children,
	redirectPath = "/auth/login",
	clientType,
	shouldRedirectOnUnauthorized,
	revalidateSessionEnabled,
	sessionHint,
}: ClientAuthWrapperProps): JSX.Element {
	const router = useRouter();
	const pathname = usePathname();
	// Where a session exit is heading. Once that navigation has committed (the
	// pathname arrived there), the route is refreshed so the server layouts —
	// which persist across client navigations — render again without the
	// session. Event-driven: no timer guessing when the navigation is done.
	const exitTargetRef = useRef<string | null>(null);

	useEffect((): void => {
		if (exitTargetRef.current !== null && exitTargetRef.current === pathname) {
			exitTargetRef.current = null;
			router.refresh();
		}
	}, [pathname, router]);

	const leaveSession = useCallback(
		(url: string): void => {
			const target: string = pathnameOf(url);
			if (target === pathname) {
				router.refresh();
				return;
			}
			exitTargetRef.current = target;
			router.replace(url);
		},
		[pathname, router],
	);

	return (
		<AuthProvider
			onUnauthorizedRedirect={redirectPath}
			leaveSession={leaveSession}
			clientType={clientType}
			shouldRedirectOnUnauthorized={shouldRedirectOnUnauthorized}
			revalidateSessionEnabled={revalidateSessionEnabled}
			sessionHint={sessionHint}>
			{children}
		</AuthProvider>
	);
}
