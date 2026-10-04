import { createFeatureStore, type FeatureStore } from "@workspace/client/lib/state/feature-store";

import { tenantContextActions, type TenantContextAction } from "./actions";
import { createLocationCookieEffect, createScopeRefreshEffect, type LocationCookieWriter } from "./effects";
import { tenantContextReducer } from "./reducer";
import { INITIAL_TENANT_CONTEXT_STATE, type TenantContextState } from "./state";

export type TenantContextStore = FeatureStore<TenantContextState, TenantContextAction>;

export interface TenantContextStoreDependencies {
	/** Redux DevTools instance name (e.g. `Tenant Context · merchant`). */
	readonly devtoolsName: string;
	/** Cookie the server reads to prefetch the chosen store (a fake in tests). */
	readonly locationCookie: LocationCookieWriter;
	/** Re-reads the organization context (invalidates its query) — after the API refused a store. */
	readonly refreshOrganizationContext: () => void;
}

/**
 * One tenant-context store, initialized with the server-read cookie value —
 * dispatched synchronously, so the very first render (server and client)
 * already filters by it.
 */
export function createTenantContextStore(dependencies: TenantContextStoreDependencies, initialLocationId: string | null): TenantContextStore {
	const store = createFeatureStore<TenantContextState, TenantContextAction>({
		name: dependencies.devtoolsName,
		initialState: INITIAL_TENANT_CONTEXT_STATE,
		reducer: tenantContextReducer,
		effects: [createLocationCookieEffect(dependencies.locationCookie), createScopeRefreshEffect(dependencies.refreshOrganizationContext)],
	});
	store.dispatch(tenantContextActions.initialized(initialLocationId));
	return store;
}
