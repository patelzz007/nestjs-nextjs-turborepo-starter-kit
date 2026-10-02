/**
 * Merchant tenant context — the member's chosen store (location) inside the
 * current organization. Owner: Zustand, because the topbar switcher, the scope
 * banner and every location-filtered page view share it in the browser. The
 * `organizationLocationId` cookie mirrors it (see `effects.ts`) so server pages
 * can prefetch the same store's data.
 *
 * NOT here, deliberately:
 * - the organization (tenant) — the URL owns it (`/orgs/[orgSlug]`); the
 *   provider is keyed by it, so another organization starts a fresh store;
 * - the member's accessible locations — server state owned by TanStack Query
 *   (`api.organizations.context`); the selectors combine both at read time;
 * - the effective location — derived (`resolveEffectiveLocationId`), never stored.
 *
 * Client state is never a security boundary: the API re-validates every
 * `locationId` against the membership on every request.
 */
export interface TenantContextState {
	/**
	 * The store the member last chose; `null` = no specific store. Whether
	 * that means "all stores" or "the only store" is decided by the
	 * selectors from the accessible locations — the choice itself is kept
	 * as made, so it can be validated again when the locations change.
	 */
	readonly selectedLocationId: string | null;
}

export const INITIAL_TENANT_CONTEXT_STATE: TenantContextState = {
	selectedLocationId: null,
};
