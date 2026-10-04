import { assertNever } from "@workspace/shared";
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
		case "[ Tenant Context ] Location Rejected":
			// Remembered for the mount, so the selectors never fall back onto it again (no 403 loop),
			// and dropped as the choice when it was the choice.
			return {
				...state,
				selectedLocationId: state.selectedLocationId === action.locationId ? null : state.selectedLocationId,
				rejectedLocationIds: state.rejectedLocationIds.includes(action.locationId) ? state.rejectedLocationIds : [...state.rejectedLocationIds, action.locationId],
			};
		default:
			return assertNever(action, "tenant context action");
	}
}
