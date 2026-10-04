"use client";

import { FeatureUnavailableNotice, SignInPrompt } from "@/components/auth/access-fallback";
import { useWebSession } from "@/components/auth/web-authorization-provider";
import { useAuthorization, type CapabilityCheckMode } from "@workspace/client/lib/auth/can";
import type { CapabilitySlug } from "@workspace/shared";
import { usePathname } from "next/navigation";
import * as React from "react";

export interface AccessGateProps {
	/** Human label for the gated section ("your rewards") — used in the default fallback copy. */
	readonly feature: string;
	/** Required capability. Omit for sections the API allows for every signed-in user. */
	readonly permission?: CapabilitySlug;
	/** Alternative to `permission`, evaluated with `mode` semantics. */
	readonly permissions?: readonly CapabilitySlug[];
	readonly mode?: CapabilityCheckMode;
	/** Where sign-in returns to — defaults to the current path. */
	readonly returnTo?: string;
	readonly signInDescription?: string;
	readonly className?: string;
	readonly children: React.ReactNode;
}

/**
 * Section-level gate (UX only — the API enforces the same rule):
 * - guest → sign-in prompt;
 * - signed in without the required permission → "not available" notice;
 * - otherwise → children.
 *
 * While the capability set is still loading nothing renders, so a permitted
 * user never sees a denial flash.
 */
export function AccessGate({ feature, permission, permissions, mode = "any", returnTo, signInDescription, className, children }: AccessGateProps): React.JSX.Element | null {
	const pathname = usePathname();
	const { isAuthenticated, isResolved } = useWebSession();
	const { can, canAll, canAny } = useAuthorization();

	if (!isAuthenticated) {
		return <SignInPrompt className={className} title="Sign in to continue" description={signInDescription ?? `Sign in to see ${feature}.`} returnTo={returnTo ?? pathname} />;
	}

	const requiresPermission = permission !== undefined || permissions !== undefined;
	if (!requiresPermission) {
		return <>{children}</>;
	}

	if (!isResolved) {
		return null;
	}

	const allowed = permissions !== undefined ? (mode === "all" ? canAll(permissions) : canAny(permissions)) : permission !== undefined && can(permission);

	if (!allowed) {
		return <FeatureUnavailableNotice className={className} feature={feature} />;
	}

	return <>{children}</>;
}
