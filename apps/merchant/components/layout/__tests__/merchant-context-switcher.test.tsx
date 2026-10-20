// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import type { TenantRewardMembershipResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	ALL_LOCATIONS_VALUE,
	applyLocationChoice,
	locationSwitcherDescription,
	locationSwitcherOptions,
	locationSwitcherSubtitle,
	MerchantContextSwitcher,
	storeSwitcherStores,
	type SwitcherStore,
} from "@/components/layout/merchant-context-switcher";
import { clearLocationCookie, locationCookieName } from "@/contexts/tenancy/lib/org/location";
import { membershipFixture, renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";
import { contextQueryState, tenantContextFixture, STORE_A_LOCATION, STORE_B_LOCATION, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A, STORE_B } from "@/test/terminals";
import { SidebarProvider } from "@workspace/ui/components/sidebar";

const { contextQuery, push } = vi.hoisted(() => ({
	contextQuery: vi.fn<() => ContextQueryState>(),
	push: vi.fn<(href: string) => void>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { tenants: { context: { useQuery: contextQuery } } } }),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): object => ({ push }),
	useParams: (): object => ({ tenantSlug: TEST_ORG_SLUG }),
}));

/** A member scoped to one store location: nothing org-wide to roll up to. */
const SINGLE_LOCATION_CONTEXT = tenantContextFixture({ locations: [STORE_A_LOCATION], locationScopeType: "SELECTED", locationIds: [STORE_A.id] });

const OWNER: TenantRewardMembershipResponse = membershipFixture("OWNER");
const OTHER_STORE: TenantRewardMembershipResponse = {
	...membershipFixture("CASHIER"),
	tenantSlug: "brew-bros",
	displayName: "Brew Bros",
	tenantId: "1d3b6c4e-2f0a-4b8e-9c71-5a2d8e6f4b10",
};

beforeEach((): void => {
	contextQuery.mockReturnValue(contextQueryState(TWO_STORE_CONTEXT));
	// jsdom has no matchMedia; the sidebar provider (the switcher keeps its collapse toggle) reads the mobile breakpoint through it.
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: false,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	}));
});

/** The switcher sits in the sidebar header, inside the shell's sidebar provider. */
function inSidebar(ui: React.ReactElement): React.ReactElement {
	return <SidebarProvider>{ui}</SidebarProvider>;
}

afterEach((): void => {
	cleanup();
	contextQuery.mockReset();
	push.mockReset();
	vi.unstubAllGlobals();
	clearLocationCookie(TEST_ORG_SLUG);
});

function renderSwitcher(
	memberships: readonly TenantRewardMembershipResponse[],
	initialLocationId: string | null,
	onStoreChange = vi.fn<(slug: string) => void>(),
	hasMoreStores = false,
): void {
	renderWithAuthorization(
		inSidebar(<MerchantContextSwitcher memberships={memberships} hasMoreStores={hasMoreStores} tenantSlug={TEST_ORG_SLUG} onStoreChange={onStoreChange} />),
		{
			role: "OWNER",
			tenantContext: { initialLocationId, initialTenantContext: testEnvelope(TWO_STORE_CONTEXT) },
		},
	);
}

function openMenu(): HTMLElement {
	fireEvent.click(screen.getByRole("button", { name: /^Switch store or location/u }));
	return screen.getByRole("menu");
}

describe("location switcher helpers", () => {
	it("offers all locations first only to members who may see org-wide rollups", () => {
		expect(locationSwitcherOptions([STORE_A_LOCATION, STORE_B_LOCATION], true).map((option) => option.value)).toStrictEqual([ALL_LOCATIONS_VALUE, STORE_A.id, STORE_B.id]);
		expect(locationSwitcherOptions([STORE_A_LOCATION], false).map((option) => option.value)).toStrictEqual([STORE_A.id]);
	});

	it("gives a location a second line only when its full name says more than its label", () => {
		expect(locationSwitcherDescription({ id: "a", name: "Brew & Bean KL — Bukit Bintang", code: "bukit-bintang" })).toBeUndefined();
		expect(locationSwitcherDescription({ id: "b", name: "Central kitchen", code: "primary" })).toBe("Central kitchen");
	});

	it("reads the active location, all locations, or nothing for the trigger's second line", () => {
		expect(locationSwitcherSubtitle(STORE_A_LOCATION, STORE_A.id, true)).toBe(locationSwitcherOptions([STORE_A_LOCATION], false).at(0)?.label);
		expect(locationSwitcherSubtitle(undefined, undefined, true)).toBe("All locations");
		expect(locationSwitcherSubtitle(undefined, undefined, false)).toBeUndefined();
	});

	it("applies a choice through the tenant-context commands", () => {
		const commands = { selectAllLocations: vi.fn<() => void>(), selectLocation: vi.fn<(id: string) => void>() };
		applyLocationChoice(commands, ALL_LOCATIONS_VALUE);
		applyLocationChoice(commands, STORE_B.id);
		expect(commands.selectAllLocations).toHaveBeenCalledTimes(1);
		expect(commands.selectLocation).toHaveBeenCalledWith(STORE_B.id);
	});
});

describe("MerchantContextSwitcher", () => {
	it("names the store and the location in effect on the trigger, from the first render", () => {
		renderSwitcher([OWNER], STORE_B.id);
		const trigger = screen.getByRole("button", { name: /^Switch store or location: Acme Coffee, /u });
		expect(trigger.textContent).toContain("Acme Coffee");
	});

	it("switches location from the menu and remembers it for the server", () => {
		renderSwitcher([OWNER], null);
		expect(screen.getByRole("button", { name: "Switch store or location: Acme Coffee, All locations" })).toBeTruthy();
		const menu = openMenu();
		expect(within(menu).getByText("Locations")).toBeTruthy();
		const [all] = within(menu).getAllByRole("menuitemradio");
		expect(all?.getAttribute("aria-checked")).toBe("true");
		fireEvent.click(within(menu).getByRole("menuitemradio", { name: new RegExp(STORE_A.name, "u") }));
		expect(document.cookie).toContain(`${locationCookieName(TEST_ORG_SLUG)}=${STORE_A.id}`);
	});

	it("lists the member's other stores only when there is one to switch to", () => {
		const onStoreChange = vi.fn<(slug: string) => void>();
		renderSwitcher([OWNER, OTHER_STORE], null, onStoreChange);
		const menu = openMenu();
		expect(within(menu).getByText("Stores")).toBeTruthy();
		fireEvent.click(within(menu).getByRole("menuitemradio", { name: /Brew Bros/u }));
		expect(onStoreChange).toHaveBeenCalledWith("brew-bros");
		cleanup();
		renderSwitcher([OWNER], null);
		expect(within(openMenu()).queryByText("Stores")).toBeNull();
	});

	it("offers All stores — the stores page — when the member has more stores than the first page", () => {
		renderSwitcher([OWNER], null, vi.fn<(slug: string) => void>(), true);
		const menu = openMenu();
		expect(within(menu).getByText("Stores")).toBeTruthy();
		fireEvent.click(within(menu).getByRole("menuitem", { name: "All stores" }));
		expect(push).toHaveBeenCalledWith(`/t/${TEST_ORG_SLUG}/stores`);
		cleanup();
		renderSwitcher([OWNER, OTHER_STORE], null);
		expect(within(openMenu()).queryByRole("menuitem", { name: "All stores" })).toBeNull();
	});

	it("opens the locations settings from Manage locations", () => {
		renderSwitcher([OWNER], null);
		fireEvent.click(within(openMenu()).getByRole("menuitem", { name: "Manage locations" }));
		expect(push).toHaveBeenCalledWith(`/t/${TEST_ORG_SLUG}/settings/locations`);
	});

	it("shows a single-location member's only location, checked", () => {
		contextQuery.mockReturnValue(contextQueryState(SINGLE_LOCATION_CONTEXT));
		renderWithAuthorization(
			inSidebar(<MerchantContextSwitcher memberships={[OWNER]} hasMoreStores={false} tenantSlug={TEST_ORG_SLUG} onStoreChange={vi.fn<(slug: string) => void>()} />),
			{
				role: "CASHIER",
				tenantContext: {
					initialLocationId: null,
					initialTenantContext: testEnvelope(SINGLE_LOCATION_CONTEXT),
				},
			},
		);
		const options = within(openMenu()).getAllByRole("menuitemradio");
		expect(options).toHaveLength(1);
		expect(options.at(0)?.getAttribute("aria-checked")).toBe("true");
	});
});

describe("storeSwitcherStores", () => {
	const first: TenantRewardMembershipResponse = { ...membershipFixture("OWNER"), tenantSlug: "store-one", displayName: "Store One" };
	const second: TenantRewardMembershipResponse = { ...membershipFixture("CASHIER"), tenantSlug: "store-two", displayName: "Store Two" };

	it("lists the first page as it is when it holds the active store", () => {
		expect(storeSwitcherStores([first, second], { slug: "store-two", displayName: "Store Two", role: "CASHIER" }).map((store) => store.slug)).toEqual([
			"store-one",
			"store-two",
		]);
	});

	it("puts an active store from a later page first, so the selected value has its option", () => {
		const later: SwitcherStore = { slug: "store-thirty", displayName: "Store Thirty", role: "ADMIN" };
		expect(storeSwitcherStores([first, second], later)).toEqual([
			later,
			{ slug: "store-one", displayName: "Store One", role: "OWNER" },
			{ slug: "store-two", displayName: "Store Two", role: "CASHIER" },
		]);
	});

	it("lists only the page while the active store is not known yet", () => {
		expect(storeSwitcherStores([first], undefined).map((store) => store.slug)).toEqual(["store-one"]);
	});
});
