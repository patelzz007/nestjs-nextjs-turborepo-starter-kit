import { describe, expect, it, vi } from "vitest";

import { STORE_A, STORE_B } from "@/test/terminals";

import { tenantContextActions } from "./actions";
import type { LocationCookieWriter } from "./effects";
import { createTenantContextStore } from "./store";

interface FakeLocationCookie extends LocationCookieWriter {
	readonly writes: (string | null)[];
}

/** Records every cookie change: a store id for a write, `null` for a clear. */
function fakeLocationCookie(): FakeLocationCookie {
	const writes: (string | null)[] = [];
	return {
		writes,
		write: (locationId: string): void => {
			writes.push(locationId);
		},
		clear: (): void => {
			writes.push(null);
		},
	};
}

function createStore(
	initialLocationId: string | null,
	cookie: LocationCookieWriter,
	refreshOrganizationContext: () => void = vi.fn(),
): ReturnType<typeof createTenantContextStore> {
	return createTenantContextStore({ devtoolsName: "Tenant Context · test", locationCookie: cookie, refreshOrganizationContext }, initialLocationId);
}

describe("tenant-context store + cookie effect", () => {
	it("starts from the server-read choice without writing the cookie it came from", () => {
		const cookie = fakeLocationCookie();

		const store = createStore(STORE_A.id, cookie);

		expect(store.getState().selectedLocationId).toBe(STORE_A.id);
		expect(cookie.writes).toEqual([]);
	});

	it("mirrors a selected store to the cookie", () => {
		const cookie = fakeLocationCookie();
		const store = createStore(null, cookie);

		store.dispatch(tenantContextActions.locationSelected(STORE_B.id));

		expect(store.getState().selectedLocationId).toBe(STORE_B.id);
		expect(cookie.writes).toEqual([STORE_B.id]);
	});

	it("clears the cookie when the member selects all locations", () => {
		const cookie = fakeLocationCookie();
		const store = createStore(STORE_A.id, cookie);

		store.dispatch(tenantContextActions.allLocationsSelected());

		expect(store.getState().selectedLocationId).toBeNull();
		expect(cookie.writes).toEqual([null]);
	});

	it("clears the cookie and re-reads the organization context when the chosen store is rejected", () => {
		const cookie = fakeLocationCookie();
		const refresh = vi.fn();
		const store = createStore(STORE_A.id, cookie, refresh);

		store.dispatch(tenantContextActions.locationRejected(STORE_A.id));

		expect(store.getState().selectedLocationId).toBeNull();
		expect(cookie.writes).toEqual([null]);
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it("rewrites the cookie with the still-valid choice when another store is rejected", () => {
		const cookie = fakeLocationCookie();
		const store = createStore(STORE_B.id, cookie);

		store.dispatch(tenantContextActions.locationRejected(STORE_A.id));

		expect(cookie.writes).toEqual([STORE_B.id]);
	});

	it("does not touch the cookie when re-initialized", () => {
		const cookie = fakeLocationCookie();
		const store = createStore(null, cookie);

		store.dispatch(tenantContextActions.initialized(STORE_B.id));

		expect(cookie.writes).toEqual([]);
	});

	it("gives every store its own state — nothing is shared between organizations or requests", () => {
		const first = createStore(STORE_A.id, fakeLocationCookie());
		const second = createStore(null, fakeLocationCookie());

		first.dispatch(tenantContextActions.locationSelected(STORE_B.id));

		expect(second.getState().selectedLocationId).toBeNull();
	});

	it("notifies subscribers once per change and runs the cookie effect for it", () => {
		const cookie = fakeLocationCookie();
		const store = createStore(null, cookie);
		const listener = vi.fn();
		store.subscribe(listener);

		store.dispatch(tenantContextActions.locationSelected(STORE_A.id));

		expect(listener).toHaveBeenCalledTimes(1);
		expect(cookie.writes).toEqual([STORE_A.id]);
	});
});
