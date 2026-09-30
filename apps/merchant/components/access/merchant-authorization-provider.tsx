"use client";

import { useMerchantCapabilities } from "@/lib/org/capabilities";
import { membershipRoleAllows, type MerchantRoleAction } from "@/lib/org/membership-roles";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import type { CapabilitySlug, OrganizationMembershipRole, OrganizationRewardMembershipResponse } from "@workspace/shared";
import * as React from "react";

/** Resolution state of the active membership that backs `useAuthorization()`. */
export interface MerchantAuthorizationStatus {
	/** True until the memberships bootstrap query settles — gates render a skeleton, never a denial. */
	readonly isLoading: boolean;
	/** Role of the active organization membership (for OWNER/ADMIN-only API rules without a capability). */
	readonly membershipRole: OrganizationMembershipRole | undefined;
	/** Granted `merchant:*` capability slugs (also fed to `CapabilitiesProvider`). */
	readonly capabilities: readonly CapabilitySlug[];
}

const NO_CAPABILITIES: readonly CapabilitySlug[] = [];

const DEFAULT_STATUS: MerchantAuthorizationStatus = {
	isLoading: false,
	membershipRole: undefined,
	capabilities: NO_CAPABILITIES,
};

const MerchantAuthorizationStatusContext = React.createContext<MerchantAuthorizationStatus>(DEFAULT_STATUS);

/** Loading/role state for the active membership. Without a provider: settled, no role (fail closed). */
export function useMerchantAuthorizationStatus(): MerchantAuthorizationStatus {
	return React.useContext(MerchantAuthorizationStatusContext);
}

/** True when the active membership role may perform an OWNER/ADMIN-only organization action. */
export function useMerchantRoleAccess(action: MerchantRoleAction): boolean {
	const { membershipRole } = useMerchantAuthorizationStatus();
	return membershipRoleAllows(membershipRole, action);
}

export interface MerchantAuthorizationStateProviderProps {
	readonly isLoading: boolean;
	readonly membershipRole: OrganizationMembershipRole | undefined;
	readonly capabilities: readonly CapabilitySlug[];
	readonly children: React.ReactNode;
}

/** Pure provider: exposes the shared `can()` / `<Can>` API plus the membership resolution state. */
export function MerchantAuthorizationStateProvider({ isLoading, membershipRole, capabilities, children }: MerchantAuthorizationStateProviderProps): React.JSX.Element {
	const status = React.useMemo((): MerchantAuthorizationStatus => ({ isLoading, membershipRole, capabilities }), [capabilities, isLoading, membershipRole]);

	return (
		<MerchantAuthorizationStatusContext.Provider value={status}>
			<CapabilitiesProvider capabilities={capabilities}>{children}</CapabilitiesProvider>
		</MerchantAuthorizationStatusContext.Provider>
	);
}

export interface MerchantAuthorizationProviderProps {
	readonly initialMemberships?: readonly OrganizationRewardMembershipResponse[];
	readonly children: React.ReactNode;
}

/**
 * Mounts the shared authorization API for the merchant portal, fed by the
 * active organization membership (single source of truth). UX only — the API
 * enforces every capability and role rule.
 */
export function MerchantAuthorizationProvider({ initialMemberships, children }: MerchantAuthorizationProviderProps): React.JSX.Element {
	const { membership, capabilities, isLoading } = useMerchantCapabilities(initialMemberships);

	return (
		<MerchantAuthorizationStateProvider isLoading={isLoading} membershipRole={membership?.role} capabilities={capabilities}>
			{children}
		</MerchantAuthorizationStateProvider>
	);
}
