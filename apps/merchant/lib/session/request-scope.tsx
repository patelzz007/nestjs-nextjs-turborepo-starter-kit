"use client";

import { LOCATION_ID_HEADER, TENANT_ID_HEADER } from "@workspace/shared";
import * as React from "react";

/**
 * The tenant and store the member is working in, as every API call names them: `X-Tenant-Id` and
 * `X-Location-Id`. Information only for now — the API selects, authorizes and scopes nothing from
 * these headers (the tenant comes from the `/tenants/:tenantSlug` path, a store from the query).
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

/**
 * Where the API client reads the scope as each request is sent. The tenant-context provider writes
 * it; the root provider owns it (one per tab), so the client above the tenant layout sees the
 * current choice without being rebuilt when it changes.
 */
export interface RequestScopeHolder {
	readonly read: () => RequestScope;
	readonly write: (scope: RequestScope) => void;
}

export function createRequestScopeHolder(): RequestScopeHolder {
	let current: RequestScope = NO_REQUEST_SCOPE;
	return {
		read: (): RequestScope => current,
		write: (scope: RequestScope): void => {
			current = scope;
		},
	};
}

const RequestScopeContext = React.createContext<RequestScopeHolder | null>(null);
RequestScopeContext.displayName = "RequestScopeContext";

export const RequestScopeProvider = RequestScopeContext.Provider;

/**
 * Names `scope` on every API call while the caller is mounted, and stops naming it on unmount
 * (leaving the tenant). Outside a {@link RequestScopeProvider} it does nothing.
 */
export function useRequestScope(scope: RequestScope): void {
	const holder = React.useContext(RequestScopeContext);
	const { tenantId, locationId } = scope;
	React.useEffect((): (() => void) | undefined => {
		if (holder === null) {
			return undefined;
		}
		holder.write({ tenantId, locationId });
		return (): void => {
			holder.write(NO_REQUEST_SCOPE);
		};
	}, [holder, tenantId, locationId]);
}
