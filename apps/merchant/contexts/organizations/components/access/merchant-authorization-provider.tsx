"use client";

import { useMerchantCapabilities } from "@/contexts/organizations/lib/org/capabilities";
import { CapabilitiesProvider } from "@workspace/client/lib/contexts/authorization";
import type { CapabilitySlug } from "@workspace/shared";
import * as React from "react";

/** Resolution state of the active membership that backs `useAuthorization()`. */
export interface MerchantAuthorizationStatus {
	/** True until the organization context settles — gates render a skeleton, never a denial. */
	readonly isLoading: boolean;
	/** Granted `merchant:*` capability slugs (also fed to `CapabilitiesProvider`). */
	readonly capabilities: readonly CapabilitySlug[];
}

const NO_CAPABILITIES: readonly CapabilitySlug[] = [];

const DEFAULT_STATUS: MerchantAuthorizationStatus = {
	isLoading: false,
	capabilities: NO_CAPABILITIES,
};

const MerchantAuthorizationStatusContext = React.createContext<MerchantAuthorizationStatus>(DEFAULT_STATUS);

/** Loading state + capabilities of the active membership. Without a provider: settled, no capabilities (fail closed). */
export function useMerchantAuthorizationStatus(): MerchantAuthorizationStatus {
	return React.useContext(MerchantAuthorizationStatusContext);
}

export interface MerchantAuthorizationStateProviderProps {
	readonly isLoading: boolean;
	readonly capabilities: readonly CapabilitySlug[];
	readonly children: React.ReactNode;
}

/** Pure provider: exposes the shared `can()` / `<Can>` API plus the membership resolution state. */
export function MerchantAuthorizationStateProvider({ isLoading, capabilities, children }: MerchantAuthorizationStateProviderProps): React.JSX.Element {
	const status = React.useMemo((): MerchantAuthorizationStatus => ({ isLoading, capabilities }), [capabilities, isLoading]);

	return (
		<MerchantAuthorizationStatusContext.Provider value={status}>
			<CapabilitiesProvider capabilities={capabilities}>{children}</CapabilitiesProvider>
		</MerchantAuthorizationStatusContext.Provider>
	);
}

export interface MerchantAuthorizationProviderProps {
	readonly children: React.ReactNode;
}

/**
 * Mounts the shared authorization API for the merchant portal, fed by the
 * member's role in the URL's organization (the organization context, read
 * through the tenant-context feature — mount it inside `TenantContextProvider`)
 * → `merchant:*` capabilities (the table the API enforces first). Every UI gate checks a capability, never a
 * role name. UX only — the API enforces every capability.
 */
export function MerchantAuthorizationProvider({ children }: MerchantAuthorizationProviderProps): React.JSX.Element {
	const { capabilities, isLoading } = useMerchantCapabilities();

	return (
		<MerchantAuthorizationStateProvider isLoading={isLoading} capabilities={capabilities}>
			{children}
		</MerchantAuthorizationStateProvider>
	);
}
