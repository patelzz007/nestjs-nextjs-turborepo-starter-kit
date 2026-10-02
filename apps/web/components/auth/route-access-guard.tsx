"use client";

import { AccessUnavailableNotice, SignInPrompt } from "@/components/auth/access-fallback";
import { useWebSession } from "@/components/auth/web-authorization-provider";
import { canAccessWebPath, isWebRouteAllowed, resolveWebRouteAccess, WEB_ROUTE_ACCESS, type WebRouteAccessRule, type WebRouteSession } from "@/lib/navigation/route-access";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import type { CapabilitySlug } from "@workspace/shared";
import { usePathname } from "next/navigation";
import * as React from "react";

/** The current session in the shape route rules are evaluated against. */
export function useWebRouteSession(): WebRouteSession {
	const { isAuthenticated } = useWebSession();
	const { can } = useAuthorization();
	return React.useMemo(
		(): WebRouteSession => ({
			isAuthenticated,
			isGranted: (permission: CapabilitySlug): boolean => can(permission),
		}),
		[can, isAuthenticated],
	);
}

/**
 * `href → may this session open it?` from the same route table the guard
 * enforces — used to filter the command palette, pinned items and quick
 * actions so they never offer a page the guard would deny.
 */
export function useCanAccessWebPath(rules: readonly WebRouteAccessRule[] = WEB_ROUTE_ACCESS): (href: string) => boolean {
	const session = useWebRouteSession();
	return React.useCallback((href: string): boolean => canAccessWebPath(href, session, rules), [rules, session]);
}

export interface WebRouteAccessGuardProps {
	/** Route table; defaults to the app's `WEB_ROUTE_ACCESS` (overridable for tests). */
	readonly rules?: readonly WebRouteAccessRule[];
	readonly children: React.ReactNode;
}

/**
 * Page-level gate for the capability requirements in `WEB_ROUTE_ACCESS`
 * (UX only — the API enforces the same rule on every request, and
 * `proxy.ts` already enforces each page's audience on the server):
 * - page without a capability requirement → rendered as is;
 * - permissions still loading → nothing, so an allowed member never sees a denial flash;
 * - guest → sign-in prompt; signed in without the capability → "not available" notice.
 *
 * A brute-forced URL therefore shows the notice instead of the page.
 */
export function WebRouteAccessGuard({ rules = WEB_ROUTE_ACCESS, children }: WebRouteAccessGuardProps): React.JSX.Element | null {
	const pathname = usePathname();
	const { isResolved } = useWebSession();
	const session = useWebRouteSession();
	const rule = React.useMemo(() => resolveWebRouteAccess(pathname, rules), [pathname, rules]);

	if (rule?.authorization === undefined) {
		return <>{children}</>;
	}
	if (!session.isAuthenticated) {
		return <SignInPrompt title="Sign in to continue" description="Sign in to see this page." returnTo={pathname} />;
	}
	if (!isResolved) {
		return null;
	}
	if (!isWebRouteAllowed(rule, session)) {
		return <AccessUnavailableNotice title="Not available for your account" description="Your account doesn't have access to this page." />;
	}
	return <>{children}</>;
}
