"use client";

import { isRestrictedAuthUser, resolveAuthEnrollmentReason } from "@workspace/client/lib/auth/session/map-auth-user";
import { useAuth } from "@workspace/client/lib/auth";
import type { EnrollmentReason } from "@workspace/shared";
import * as React from "react";

import { isPathWithin, ORG_ROUTES, ROUTES, toOrgRelativePath } from "@/lib/routes";

export const MERCHANT_EMAIL_ENROLLMENT_DISABLED_TOOLTIP = "Verify your email to access this page";
export const MERCHANT_MFA_ENROLLMENT_DISABLED_TOOLTIP = "Set up two-factor authentication to access this page";

/**
 * Whether a merchant route stays reachable while enrollment is pending — only
 * the personal account, where email verification / MFA enrollment happens.
 * Accepts org-relative menu URLs (`/account`), the top-level `/account` entry,
 * and org-scoped hrefs (`/orgs/{slug}/account/**`). Mirrors the proxy's
 * `isEnrollmentAllowedPath` for the merchant surface.
 */
export function isMerchantEnrollmentAllowedPath(pathname: string): boolean {
	if (isPathWithin(pathname, ROUTES.account) || isPathWithin(pathname, ORG_ROUTES.account)) {
		return true;
	}

	const orgRelativePath = toOrgRelativePath(pathname);
	return orgRelativePath !== undefined && isPathWithin(orgRelativePath, ORG_ROUTES.account);
}

export interface MerchantEnrollmentLock {
	readonly isLocked: boolean;
	readonly enrollmentReason: EnrollmentReason | null;
	readonly disabledTooltip: string;
}

function resolveEnrollmentDisabledTooltip(enrollmentReason: EnrollmentReason | null): string {
	if (enrollmentReason === "mfa_enrollment") {
		return MERCHANT_MFA_ENROLLMENT_DISABLED_TOOLTIP;
	}

	return MERCHANT_EMAIL_ENROLLMENT_DISABLED_TOOLTIP;
}

/** True when the signed-in merchant must complete enrollment before using the portal. */
export function useMerchantEnrollmentLock(): MerchantEnrollmentLock {
	const { user } = useAuth();
	const isLocked = isRestrictedAuthUser(user);
	const enrollmentReason = user === null ? null : resolveAuthEnrollmentReason(user);

	return React.useMemo(
		(): MerchantEnrollmentLock => ({
			isLocked,
			enrollmentReason,
			disabledTooltip: resolveEnrollmentDisabledTooltip(enrollmentReason),
		}),
		[enrollmentReason, isLocked],
	);
}
