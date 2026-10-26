import { LOCATION_ID_HEADER, TENANT_ID_HEADER } from "@workspace/shared";

/**
 * The tenant and store the member is working in, as every API call names them: `X-Tenant-Id` and
 * `X-Location-Id`. The API records them in its audit trail as what the client claimed, next to the
 * tenant it verified; it selects, authorizes and scopes nothing from them (the tenant comes from the
 * `/tenants/:tenantSlug` path, a store from the query).
 *
 * A plain module, not a client one, so server pages build the same headers (`loadTenantServerCaller`).
 */
export interface RequestScope {
	/** The open tenant's id; `undefined` outside a tenant or until its context has loaded. */
	readonly tenantId: string | undefined;
	/** The chosen store; `null` for "All locations" (or no tenant), so no single store is named. */
	readonly locationId: string | null;
}

export const NO_REQUEST_SCOPE: RequestScope = { tenantId: undefined, locationId: null };

/** The headers one request carries for `scope`: each only when it names something. */
export function requestScopeHeaders(scope: RequestScope): Readonly<Record<string, string>> {
	return {
		...(scope.tenantId === undefined ? {} : { [TENANT_ID_HEADER]: scope.tenantId }),
		...(scope.locationId === null ? {} : { [LOCATION_ID_HEADER]: scope.locationId }),
	};
}
