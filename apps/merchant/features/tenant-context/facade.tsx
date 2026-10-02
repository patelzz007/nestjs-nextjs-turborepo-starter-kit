"use client";

import { canSelectAllLocations, resolveAccessibleLocations } from "@/lib/org/location-access";
import { clearOrganizationLocationCookie, writeOrganizationLocationCookie } from "@/lib/org/location";
import { initialDataOption, stubApiMeta, successEnvelope } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { createFeatureStoreContext } from "@workspace/client/lib/state/feature-store-context";
import type { Envelope, OrganizationContextResponse, OrganizationLocationResponse } from "@workspace/shared";
import * as React from "react";

import { tenantContextActions, type TenantContextAction } from "./actions";
import type { LocationCookieWriter } from "./effects";
import { resolveActiveLocation, resolveEffectiveLocationId, selectSelectedLocationId, toLocationQueryInput } from "./selectors";
import type { TenantContextState } from "./state";
import { createTenantContextStore, type TenantContextStore } from "./store";

/**
 * Tenant-context feature API — components use ONLY this module: read the
 * store filter with the narrow hooks, change it with
 * `useTenantContextCommands()`. The effective location is derived here from
 * the store (the member's choice) and TanStack Query (the accessible
 * locations); neither copy is ever written into the other.
 */

const TENANT_CONTEXT_DEVTOOLS_NAME = "Tenant Context · merchant";

const BROWSER_LOCATION_COOKIE: LocationCookieWriter = {
	write: writeOrganizationLocationCookie,
	clear: clearOrganizationLocationCookie,
};

const NO_LOCATIONS: readonly OrganizationLocationResponse[] = [];

const tenantContext = createFeatureStoreContext<TenantContextState, TenantContextAction>("Tenant Context");
const TenantContextStoreProvider = tenantContext.provider;

/** Per-mount inputs from the server: the tenant (URL segment) and the context seed. Not state — never changes for a mount. */
interface TenantScope {
	readonly orgSlug: string;
	readonly initialOrganizationContext: Envelope<OrganizationContextResponse> | undefined;
}

const TenantScopeContext = React.createContext<TenantScope | null>(null);
TenantScopeContext.displayName = "TenantScopeContext";

export interface TenantContextProviderProps {
	/** The `[orgSlug]` URL segment — the tenant. Another organization mounts a fresh store. */
	readonly orgSlug: string;
	/** The `organizationLocationId` cookie as the server read it (`ServerLocationScope.selectedLocationId`). */
	readonly initialLocationId: string | null;
	/** The organization context the server loaded — seeds the query so the first render already validates the choice. */
	readonly initialOrganizationContext?: OrganizationContextResponse | undefined;
	readonly children: React.ReactNode;
}

/** Mount once in the persistent `/orgs/[orgSlug]` shell so page navigation keeps the chosen store. */
export function TenantContextProvider(props: TenantContextProviderProps): React.JSX.Element {
	return <OrganizationTenantContextProvider key={props.orgSlug} {...props} />;
}

function OrganizationTenantContextProvider({ orgSlug, initialLocationId, initialOrganizationContext, children }: TenantContextProviderProps): React.JSX.Element {
	const createStore = React.useCallback(
		(): TenantContextStore => createTenantContextStore({ devtoolsName: TENANT_CONTEXT_DEVTOOLS_NAME, locationCookie: BROWSER_LOCATION_COOKIE }, initialLocationId),
		[initialLocationId],
	);
	const scope = React.useMemo(
		(): TenantScope => ({
			orgSlug,
			initialOrganizationContext: initialOrganizationContext === undefined ? undefined : successEnvelope(initialOrganizationContext, stubApiMeta()),
		}),
		[initialOrganizationContext, orgSlug],
	);

	return (
		<TenantScopeContext.Provider value={scope}>
			<TenantContextStoreProvider createStore={createStore}>{children}</TenantContextStoreProvider>
		</TenantScopeContext.Provider>
	);
}

function useTenantScope(): TenantScope {
	const scope = React.useContext(TenantScopeContext);
	if (scope === null) {
		throw new Error("Tenant Context store is missing — render inside its provider");
	}
	return scope;
}

interface AccessibleLocationsState {
	/** `undefined` until the organization context has loaded. */
	readonly accessibleLocations: readonly OrganizationLocationResponse[] | undefined;
	readonly isLoading: boolean;
}

/** Server state: the member's accessible locations, read from the shared context query (never stored in Zustand). */
function useAccessibleLocations(): AccessibleLocationsState {
	const { api } = useAuth();
	const { orgSlug, initialOrganizationContext } = useTenantScope();
	const contextQuery = api.organizations.context.useQuery({ orgSlug }, initialDataOption(initialOrganizationContext));
	const context = contextQuery.data?.data;
	const accessibleLocations = React.useMemo(
		(): readonly OrganizationLocationResponse[] | undefined => (context === undefined ? undefined : resolveAccessibleLocations(context)),
		[context],
	);
	return { accessibleLocations, isLoading: contextQuery.isLoading };
}

/** The store filter in effect (`null` = all stores) — the choice, validated against the accessible locations. */
export function useActiveLocationId(): string | null {
	const selectedLocationId = tenantContext.useFeatureSelector(selectSelectedLocationId);
	const { accessibleLocations } = useAccessibleLocations();
	return resolveEffectiveLocationId(selectedLocationId, accessibleLocations);
}

/**
 * Location filter for org-scoped operational queries, in API input form
 * (`undefined` = all stores). Queries put it in their key, so a change fetches
 * the new store and keeps the old one cached — no invalidation needed.
 */
export function useActiveLocationFilter(): { readonly locationId: string | undefined } {
	const activeLocationId = useActiveLocationId();
	return React.useMemo((): { readonly locationId: string | undefined } => ({ locationId: toLocationQueryInput(activeLocationId) }), [activeLocationId]);
}

export interface TenantContextCommands {
	/** The member picked one store. */
	readonly selectLocation: (locationId: string) => void;
	/** The member picked "All locations". */
	readonly selectAllLocations: () => void;
}

/** Stable command functions (same identity for the provider's lifetime — safe in effect deps). */
export function useTenantContextCommands(): TenantContextCommands {
	const { dispatch } = tenantContext.useFeatureStore();
	return React.useMemo(
		(): TenantContextCommands => ({
			selectLocation: (locationId: string): void => {
				dispatch(tenantContextActions.locationSelected(locationId));
			},
			selectAllLocations: (): void => {
				dispatch(tenantContextActions.allLocationsSelected());
			},
		}),
		[dispatch],
	);
}

export interface MerchantLocationState {
	/** The filter in effect, API input form (`undefined` = all stores). */
	readonly locationId: string | undefined;
	/** The accessible location the filter points at (`undefined` for all stores). */
	readonly activeLocation: OrganizationLocationResponse | undefined;
	/** Active locations the member may operate on (empty until loaded). */
	readonly accessibleLocations: readonly OrganizationLocationResponse[];
	/** Whether "All locations" (org-wide rollups) is an option for this member. */
	readonly canSelectAllLocations: boolean;
	/** True until the organization context has loaded for the first time. */
	readonly isLoading: boolean;
}

/** Everything the location switcher, the scope banner and location-aware forms render from. */
export function useMerchantLocation(): MerchantLocationState {
	const selectedLocationId = tenantContext.useFeatureSelector(selectSelectedLocationId);
	const { accessibleLocations, isLoading } = useAccessibleLocations();
	const effectiveLocationId = resolveEffectiveLocationId(selectedLocationId, accessibleLocations);

	return React.useMemo(
		(): MerchantLocationState => ({
			locationId: toLocationQueryInput(effectiveLocationId),
			activeLocation: resolveActiveLocation(effectiveLocationId, accessibleLocations),
			accessibleLocations: accessibleLocations ?? NO_LOCATIONS,
			canSelectAllLocations: accessibleLocations !== undefined && canSelectAllLocations(accessibleLocations),
			isLoading,
		}),
		[accessibleLocations, effectiveLocationId, isLoading],
	);
}
