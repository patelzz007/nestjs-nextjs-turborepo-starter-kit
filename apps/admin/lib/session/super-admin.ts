"use client";

import { useAuth } from "@workspace/client/lib/auth";
import * as React from "react";

export interface SuperAdminStatus {
	/** Session carries the platform super-admin flag (`@SuperAdminOnly` routes). */
	readonly isSuperAdmin: boolean;
	/** False until the session identity is known — gate callers render nothing meanwhile. */
	readonly isResolved: boolean;
}

/**
 * The session's super-admin flag from the auth context — the single client
 * source for `@SuperAdminOnly` API routes (which have no capability slug).
 * UX only: the API re-checks the flag on every request.
 */
export function useSuperAdminStatus(): SuperAdminStatus {
	const { user, isLoading } = useAuth();
	const isSuperAdmin = user?.isSuperAdmin === true;
	const isResolved = user !== null || !isLoading;
	return React.useMemo((): SuperAdminStatus => ({ isSuperAdmin, isResolved }), [isSuperAdmin, isResolved]);
}

/**
 * `POST /auth/impersonate/:userId` is `@SuperAdminOnly`, and nested
 * impersonation is refused — so starting one needs a super-admin session that
 * is not already impersonating.
 */
export function useCanStartImpersonation(): boolean {
	const { api } = useAuth();
	const { isSuperAdmin } = useSuperAdminStatus();
	const permissionsQuery = api.auth.permissions.useQuery(undefined);
	const isImpersonating = permissionsQuery.data?.data.isImpersonating === true;
	return isSuperAdmin && !isImpersonating;
}
