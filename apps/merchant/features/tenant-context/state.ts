/**
 * Merchant tenant context — the member's chosen store (location) inside the
 * current organization. Owner: Zustand, because the topbar switcher, the scope
 * banner and every location-filtered page view share it in the browser. The
 * organization's `organizationLocationId.<orgSlug>` cookie mirrors it (see
 * `effects.ts`) so server pages can prefetch the same store's data.
 *
 * NOT here, deliberately:
 * - the organization (tenant) — the URL owns it (`/orgs/[orgSlug]`); the
 *   provider is keyed by it, so another organization starts a fresh store;
 * - the member's accessible locations — server state owned by TanStack Query
 *   (`api.organizations.context`); the selectors combine both at read time;
 * - the effective location — derived (`resolveEffectiveLocationId`), never stored.
 *
 * Client state is never a security boundary. The selectors keep the filter
 * inside the member's own scope (a store-limited member is never offered "All
 * locations"); the API authorizes every request against the membership's
 * location scope — an omitted `locationId` means the member's own stores, and
 * a store outside the scope is refused (403 `ORGANIZATION_LOCATION_FORBIDDEN`),
 * which this feature turns into a "Location Rejected" action.
 */
export interface TenantContextState {
	/**
	 * The store the member last chose; `null` = no specific store. Whether
	 * that means "all stores" or "the only store" is decided by the
	 * selectors from the accessible locations — the choice itself is kept
	 * as made, so it can be validated again when the locations change.
	 */
	readonly selectedLocationId: string | null;
	/**
	 * Stores the API refused for this member during this mount (a scope that
	 * shrank after the organization context loaded). Never chosen again
	 * until the organization is reopened, so a refusal cannot loop.
	 */
	readonly rejectedLocationIds: readonly string[];
}

export const INITIAL_TENANT_CONTEXT_STATE: TenantContextState = {
	selectedLocationId: null,
	rejectedLocationIds: [],
};
