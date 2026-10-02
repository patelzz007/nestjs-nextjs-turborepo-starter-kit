// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantLocationSwitcher, MerchantLocationSwitcherMobile, resolveNextCycledLocationId } from "@/components/layout/merchant-location-switcher";
import { TenantContextProvider } from "@/features/tenant-context/facade";
import { clearOrganizationLocationCookie, ORGANIZATION_LOCATION_ID_COOKIE_NAME } from "@/lib/org/location";
import { TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, organizationContextFixture, STORE_A_LOCATION, STORE_B_LOCATION, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A, STORE_B } from "@/test/terminals";
import type { OrganizationContextResponse } from "@workspace/shared";

const { contextQuery } = vi.hoisted(() => ({
	contextQuery: vi.fn<() => ContextQueryState>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { organizations: { context: { useQuery: contextQuery } } } }),
}));

const TWO_STORES = [STORE_A_LOCATION, STORE_B_LOCATION];

function renderSwitcher(ui: React.ReactElement, context: OrganizationContextResponse, initialLocationId: string | null): void {
	contextQuery.mockReturnValue(contextQueryState(context));
	render(
		<TenantContextProvider orgSlug={TEST_ORG_SLUG} initialLocationId={initialLocationId} initialOrganizationContext={context}>
			{ui}
		</TenantContextProvider>,
	);
}

beforeEach((): void => {
	contextQuery.mockReturnValue(contextQueryState(TWO_STORE_CONTEXT));
});

afterEach((): void => {
	cleanup();
	contextQuery.mockReset();
	clearOrganizationLocationCookie();
});

describe("resolveNextCycledLocationId", () => {
	it("cycles each store, then all locations, for a member who may see org-wide rollups", () => {
		expect(resolveNextCycledLocationId(TWO_STORES, true, undefined)).toBe(STORE_A.id);
		expect(resolveNextCycledLocationId(TWO_STORES, true, STORE_A.id)).toBe(STORE_B.id);
		expect(resolveNextCycledLocationId(TWO_STORES, true, STORE_B.id)).toBeUndefined();
	});

	it("only cycles stores when all locations is not an option", () => {
		expect(resolveNextCycledLocationId(TWO_STORES, false, STORE_B.id)).toBe(STORE_A.id);
		expect(resolveNextCycledLocationId(TWO_STORES, false, undefined)).toBe(STORE_A.id);
	});
});

describe("MerchantLocationSwitcherMobile", () => {
	it("moves to the next store on tap and remembers it for the server", () => {
		renderSwitcher(<MerchantLocationSwitcherMobile />, TWO_STORE_CONTEXT, null);
		expect(screen.getByRole("button", { name: "Switch store location (current: All locations)" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: /Switch store location/u }));

		expect(screen.getByRole("button", { name: `Switch store location (current: ${STORE_A.name})` })).toBeTruthy();
		expect(document.cookie).toContain(`${ORGANIZATION_LOCATION_ID_COOKIE_NAME}=${STORE_A.id}`);
	});

	it("is hidden for a single-store member — there is nothing to switch", () => {
		renderSwitcher(<MerchantLocationSwitcherMobile />, organizationContextFixture({ locations: [STORE_A_LOCATION] }), null);

		expect(screen.queryByRole("button", { name: /Switch store location/u })).toBeNull();
	});
});

describe("MerchantLocationSwitcher", () => {
	it("shows the store in effect from the first render", () => {
		renderSwitcher(<MerchantLocationSwitcher />, TWO_STORE_CONTEXT, STORE_B.id);

		expect(screen.getByRole("combobox", { name: `Active store location: ${STORE_B.name}` })).toBeTruthy();
	});

	it("shows a single-store member's only store as a label", () => {
		renderSwitcher(<MerchantLocationSwitcher />, organizationContextFixture({ locations: [STORE_A_LOCATION] }), null);

		expect(screen.getByTitle(STORE_A.name)).toBeTruthy();
		expect(screen.queryByRole("combobox")).toBeNull();
	});
});
