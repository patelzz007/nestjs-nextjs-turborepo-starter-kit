"use client";

import * as React from "react";

import { NO_REQUEST_SCOPE, type RequestScope } from "./request-scope-headers";

export { NO_REQUEST_SCOPE, requestScopeHeaders, type RequestScope } from "./request-scope-headers";

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
	// A layout effect: it runs before any passive effect, so the first queries the page's
	// components start (TanStack Query subscribes in passive effects) already carry the scope.
	React.useLayoutEffect((): (() => void) | undefined => {
		if (holder === null) {
			return undefined;
		}
		holder.write({ tenantId, locationId });
		return (): void => {
			holder.write(NO_REQUEST_SCOPE);
		};
	}, [holder, tenantId, locationId]);
}
