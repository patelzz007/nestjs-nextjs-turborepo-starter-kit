/** Everything that can happen to the tenant context — the Redux DevTools timeline reads as these. */
export type TenantContextAction =
	/** The provider mounted with the server-read cookie value, so the first render already knows the store. */
	| { readonly type: "[ Tenant Context ] Initialized"; readonly selectedLocationId: string | null }
	/** The member picked one store in the location switcher. */
	| { readonly type: "[ Tenant Context ] Location Selected"; readonly locationId: string }
	/** The member picked "All locations" (org-wide rollups). */
	| { readonly type: "[ Tenant Context ] All Locations Selected" };

/** Action creators — the only way components (through the facade) describe what happened. */
export const tenantContextActions = {
	initialized: (selectedLocationId: string | null): TenantContextAction => ({ type: "[ Tenant Context ] Initialized", selectedLocationId }),
	locationSelected: (locationId: string): TenantContextAction => ({ type: "[ Tenant Context ] Location Selected", locationId }),
	allLocationsSelected: (): TenantContextAction => ({ type: "[ Tenant Context ] All Locations Selected" }),
};
