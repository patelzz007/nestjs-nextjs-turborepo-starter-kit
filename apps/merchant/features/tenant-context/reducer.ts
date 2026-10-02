import type { TenantContextAction } from "./actions";
import type { TenantContextState } from "./state";

/** Pure tenant-context state transitions — no I/O, no cookies, no browser APIs. */
export function tenantContextReducer(state: TenantContextState, action: TenantContextAction): TenantContextState {
	switch (action.type) {
		case "[ Tenant Context ] Initialized":
			return { ...state, selectedLocationId: action.selectedLocationId };
		case "[ Tenant Context ] Location Selected":
			return { ...state, selectedLocationId: action.locationId };
		case "[ Tenant Context ] All Locations Selected":
			return { ...state, selectedLocationId: null };
		default:
			return assertNever(action);
	}
}

/** Exhaustiveness check: adding an action without handling it fails to compile. */
function assertNever(action: never): never {
	throw new Error(`Unhandled tenant context action: ${JSON.stringify(action)}`);
}
