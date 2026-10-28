"use client";

import { useActiveMembership } from "@/features/tenant-context/facade";
import { resolveMerchantCapabilities, type MerchantRoleHolder } from "@/lib/session/server-capabilities";
import type { CapabilitySlug } from "@workspace/shared";
import * as React from "react";

export interface MerchantCapabilitiesState {
	readonly membership: MerchantRoleHolder | undefined;
	readonly capabilities: readonly CapabilitySlug[];
	readonly isLoading: boolean;
	readonly isPolicyReady: boolean;
}

/**
 * Client hook — the capabilities the member holds in the tenant the URL names, as the API computed them
 * from their role and live grants (ADR 067). Fails closed: outside tenant routes, or for an
 * tenant the user does not belong to (the context answers 404), there is no membership and no capability —
 * another tenant's role is never borrowed. Feeds `MerchantAuthorizationProvider`; UI checks go through
 * `useAuthorization().can(MERCHANT_CAPABILITY.x)` / `<Can>`.
 */
export function useMerchantCapabilities(): MerchantCapabilitiesState {
	const { membership, isLoading } = useActiveMembership();
	const capabilities = React.useMemo((): readonly CapabilitySlug[] => resolveMerchantCapabilities(membership), [membership]);
	return { membership, capabilities, isLoading, isPolicyReady: membership !== undefined };
}
