"use client";

import { useAuthorization } from "@workspace/client/lib/auth/can";
import { usePathname } from "next/navigation";
import * as React from "react";

import { AdminAccessDenied } from "@/components/access/admin-access-denied";
import { isOpenRouteRule, isRouteRuleSatisfied, resolveRouteAuthorization, type RouteAuthorizationRule } from "@/lib/navigation/route-authorization";
import type { SessionPermissionsStatus } from "@/lib/session/capabilities";
import type { SuperAdminStatus } from "@/lib/session/super-admin";
import { PermissionsLoadFailed } from "@/components/access/permissions-load-failed";

const NOT_SUPER_ADMIN: SuperAdminStatus = { isSuperAdmin: false, isResolved: true };

export interface RouteAuthorizationGuardProps {
	readonly rules: readonly RouteAuthorizationRule[];
	readonly enabledFeatureFlags: readonly string[];
	/** Whether the session permissions are known — `loading` renders nothing (no denied-state flash), `failed` offers a retry. */
	readonly permissionsStatus: SessionPermissionsStatus;
	/** Refetches the session permissions after a failure. */
	readonly onRetryPermissions: () => void;
	/** Session super-admin flag for `superAdminOnly` rules; omitted → treated as not a super admin. */
	readonly superAdmin?: SuperAdminStatus | undefined;
	readonly children: React.ReactNode;
}

/**
 * Client-side route gate: renders `AdminAccessDenied` when the current
 * pathname requires permissions (or a feature, or the super-admin flag) the
 * session lacks, and a retryable "couldn't load your permissions" state when
 * they could not be fetched — a failed fetch is never shown as a denial. UX
 * only — the API enforces authorization on every request.
 */
export function RouteAuthorizationGuard({
	rules,
	enabledFeatureFlags,
	permissionsStatus,
	onRetryPermissions,
	superAdmin = NOT_SUPER_ADMIN,
	children,
}: RouteAuthorizationGuardProps): React.JSX.Element | null {
	const pathname = usePathname();
	const { can } = useAuthorization();
	const rule = React.useMemo(() => resolveRouteAuthorization(rules, pathname), [rules, pathname]);

	if (rule === null || isOpenRouteRule(rule)) {
		return <>{children}</>;
	}
	if (permissionsStatus === "failed") {
		return <PermissionsLoadFailed onRetry={onRetryPermissions} />;
	}
	if (permissionsStatus === "loading" || (rule.superAdminOnly === true && !superAdmin.isResolved)) {
		return null;
	}
	if (!isRouteRuleSatisfied(rule, can, enabledFeatureFlags, superAdmin.isSuperAdmin)) {
		return <AdminAccessDenied />;
	}
	return <>{children}</>;
}
