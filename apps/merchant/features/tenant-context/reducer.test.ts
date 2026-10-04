import { describe, expect, it } from "vitest";

import { STORE_A, STORE_B } from "@/test/terminals";

import { tenantContextActions } from "./actions";
import { tenantContextReducer } from "./reducer";
import { selectSelectedLocationId } from "./selectors";
import { INITIAL_TENANT_CONTEXT_STATE, type TenantContextState } from "./state";

function state(selectedLocationId: string | null): TenantContextState {
	return { ...INITIAL_TENANT_CONTEXT_STATE, selectedLocationId };
}

describe("tenantContextReducer", () => {
	it("starts with no store chosen", () => {
		expect(selectSelectedLocationId(INITIAL_TENANT_CONTEXT_STATE)).toBeNull();
	});

	it("takes the server-read choice on Initialized, including none", () => {
		expect(tenantContextReducer(INITIAL_TENANT_CONTEXT_STATE, tenantContextActions.initialized(STORE_A.id))).toEqual(state(STORE_A.id));
		expect(tenantContextReducer(state(STORE_A.id), tenantContextActions.initialized(null))).toEqual(state(null));
	});

	it("records the store the member selects", () => {
		expect(tenantContextReducer(state(STORE_A.id), tenantContextActions.locationSelected(STORE_B.id))).toEqual(state(STORE_B.id));
	});

	it("drops the specific store when the member selects all locations", () => {
		expect(tenantContextReducer(state(STORE_B.id), tenantContextActions.allLocationsSelected())).toEqual(state(null));
	});

	it("drops a rejected store as the choice and remembers it, once", () => {
		const rejected = tenantContextReducer(state(STORE_A.id), tenantContextActions.locationRejected(STORE_A.id));

		expect(rejected).toEqual({ selectedLocationId: null, rejectedLocationIds: [STORE_A.id] });
		expect(tenantContextReducer(rejected, tenantContextActions.locationRejected(STORE_A.id))).toEqual(rejected);
	});

	it("keeps another store the member chose when a different one is rejected", () => {
		expect(tenantContextReducer(state(STORE_B.id), tenantContextActions.locationRejected(STORE_A.id))).toEqual({
			selectedLocationId: STORE_B.id,
			rejectedLocationIds: [STORE_A.id],
		});
	});

	it("never mutates the previous state", () => {
		const previous = state(STORE_A.id);

		tenantContextReducer(previous, tenantContextActions.locationSelected(STORE_B.id));

		expect(previous).toEqual(state(STORE_A.id));
	});
});

describe("tenantContextActions", () => {
	it("names every event `[ Tenant Context ] …` so the DevTools timeline reads as a story", () => {
		expect(tenantContextActions.initialized(null)).toEqual({ type: "[ Tenant Context ] Initialized", selectedLocationId: null });
		expect(tenantContextActions.locationSelected(STORE_A.id)).toEqual({ type: "[ Tenant Context ] Location Selected", locationId: STORE_A.id });
		expect(tenantContextActions.allLocationsSelected()).toEqual({ type: "[ Tenant Context ] All Locations Selected" });
	});
});
