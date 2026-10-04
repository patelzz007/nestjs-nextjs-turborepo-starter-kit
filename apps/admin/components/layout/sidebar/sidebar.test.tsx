// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AlertCircle } from "lucide-react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { z } from "zod";

import { ADMIN_SIDEBAR_STORAGE_KEY, compileMenu, SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { buildSidebarView, type SidebarView } from "@workspace/ui/lib/sidebar/menu-view";
import type { SearchableMenuItem } from "@/lib/navigation/searchable-menu-items";
import { ADMIN_SIDEBAR_LABELS } from "@/lib/sidebar-labels";
import type { CompiledSidebarMenuData, SidebarMenuData } from "@/lib/navigation/sidebar";
import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import {
	SidebarStoreProvider,
	useSidebarCommands,
	useSidebarExpandedItems,
	useSidebarIsOpen,
	useSidebarSearchQuery,
	useSidebarSectionOrder,
} from "@workspace/client/lib/features/sidebar/facade";
import { PERMISSION } from "@workspace/shared";

import { AdminSidebarPanel } from "@/components/layout/sidebar/sidebar";
import { PANEL_SIDEBAR_SEARCH_DEBOUNCE_MS } from "@workspace/ui/components/navigation/panel-sidebar-search";
import { SidebarProvider } from "@workspace/ui/components/navigation/sidebar";
import { DEFAULT_SIDEBAR_LABELS } from "@workspace/ui/lib/sidebar/labels";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar/storage";

const { pathnameMock, setOpenMobileMock } = vi.hoisted(() => ({
	pathnameMock: vi.fn<() => string>(),
	setOpenMobileMock: vi.fn<(open: boolean) => void>(),
}));

let harnessIsMobile = false;

vi.mock("@workspace/ui/components/navigation/sidebar", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@workspace/ui/components/navigation/sidebar")>();
	const useSidebarActual = actual.useSidebar;
	return {
		...actual,
		useSidebar: (): ReturnType<typeof actual.useSidebar> => {
			const context = useSidebarActual();
			return {
				...context,
				setOpenMobile: setOpenMobileMock,
				isMobile: harnessIsMobile,
			};
		},
	};
});

vi.mock("next/navigation", () => ({
	usePathname: (): string => pathnameMock(),
}));

/** What the probe renders: the sidebar store state, read through the facade like any component would. */
const SidebarStateSchema = z.object({
	isOpen: z.boolean(),
	sectionOrder: z.array(z.string()).nullable(),
	expandedItems: z.record(z.string(), z.boolean()),
	searchQuery: z.string(),
});

/** What the store writes to localStorage (version 1) — `searchQuery` optional so tests can assert its absence. */
const StoredPreferencesSchema = z.object({
	schemaVersion: z.literal(1),
	snapshot: z.object({
		isOpen: z.boolean(),
		sectionOrder: z.array(z.string()).nullable(),
		manualExpansion: z.object({ pathname: z.string(), items: z.record(z.string(), z.boolean()) }).nullable(),
		searchQuery: z.string().optional(),
	}),
});

const MENU: SidebarMenuData = {
	header: { title: "Acme Inc.", subtitle: "Admin Panel" },
	sections: [
		{
			title: "Main",
			items: [
				{ title: "Overview", url: "/", icon: "LayoutDashboard" },
				{
					title: "Settings",
					url: "/settings",
					icon: "Settings",
					children: [
						{ title: "General", url: "/settings/general", icon: "Gauge" },
						{ title: "Security", url: "/settings/security", icon: "Shield" },
					],
				},
				{
					title: "Analytics",
					url: "/analytics",
					icon: "BarChart3",
					disabled: true,
					children: [{ title: "Realtime", url: "/analytics/realtime", icon: "Activity" }],
				},
			],
		},
		{
			title: "Docs",
			items: [
				{
					title: "Docs Home",
					url: "/docs",
					icon: "BookOpen",
					children: [{ title: "Getting Started", url: "/docs/getting-started", icon: "Rocket" }],
				},
			],
		},
	],
	bottomItems: [{ title: "Support", url: "/support", icon: "LifeBuoy" }],
};

const COMPILED_MENU = compileMenu(MENU);

interface HarnessProps {
	readonly pathname: string;
	readonly onLogout?: () => void;
	readonly onReportIssue?: () => void;
	readonly pinnedItems?: readonly SearchableMenuItem[];
	readonly menu?: CompiledSidebarMenuData;
}

/**
 * Recreates DashboardLayout's wiring: store slices (searchQuery, sectionOrder)
 * feed a memoized `buildSidebarView`, which is passed to the Sidebar as the
 * shared `view` prop. Subscribing to the store makes the harness reactive —
 * typing in search / reordering sections re-renders with a fresh view, exactly
 * like the real layout.
 */
function SidebarHarness({ pathname, onLogout, onReportIssue, pinnedItems = [], menu = COMPILED_MENU }: HarnessProps): React.JSX.Element {
	const searchQuery = useSidebarSearchQuery();
	const sectionOrder = useSidebarSectionOrder();
	const { setSearchQuery, setItemExpanded, moveSectionUp, moveSectionDown } = useSidebarCommands();
	const view: SidebarView = React.useMemo(() => buildSidebarView({ menu, pathname, sectionOrder, searchQuery }), [menu, pathname, sectionOrder, searchQuery]);
	const expandedItems = useSidebarExpandedItems(pathname, view.routeState.autoExpandedItems);
	const handleToggleItem = React.useCallback(
		(itemId: string): void => {
			setItemExpanded(pathname, itemId, expandedItems[itemId] !== true);
		},
		[expandedItems, pathname, setItemExpanded],
	);

	return (
		<SidebarProvider labels={DEFAULT_SIDEBAR_LABELS} storage={createNoopSidebarStorage()}>
			<AdminSidebarPanel
				user={{ name: "Ada Lovelace", email: "ada@example.com" }}
				onLogout={onLogout ?? vi.fn()}
				footerActions={[{ icon: AlertCircle, label: "Report issue", onClick: onReportIssue ?? vi.fn() }]}
				view={view}
				pathname={pathname}
				labels={ADMIN_SIDEBAR_LABELS}
				searchQuery={searchQuery}
				onSearchQueryChange={setSearchQuery}
				expandedItems={expandedItems}
				onToggleItem={handleToggleItem}
				onMoveSectionUp={moveSectionUp}
				onMoveSectionDown={moveSectionDown}
				pinnedItems={pinnedItems}
				pageLabel={null}
			/>
			<output data-testid="expanded-items">{JSON.stringify(expandedItems)}</output>
		</SidebarProvider>
	);
}

/** Renders the store state as JSON, so tests assert on it without reaching into the store. */
function SidebarStateProbe({ pathname }: { readonly pathname: string }): React.JSX.Element {
	const state = {
		isOpen: useSidebarIsOpen(),
		sectionOrder: useSidebarSectionOrder(),
		expandedItems: useSidebarExpandedItems(pathname, NO_AUTO_EXPANSION),
		searchQuery: useSidebarSearchQuery(),
	};
	return <output data-testid="sidebar-state">{JSON.stringify(state)}</output>;
}

const NO_AUTO_EXPANSION: Readonly<Record<string, boolean>> = {};

function readSidebarState(): z.output<typeof SidebarStateSchema> {
	return SidebarStateSchema.parse(JSON.parse(screen.getByTestId("sidebar-state").textContent));
}

function readStoredPreferences(): z.output<typeof StoredPreferencesSchema> {
	return StoredPreferencesSchema.parse(JSON.parse(localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) ?? "null"));
}

function sidebarTree(props: HarnessProps): React.JSX.Element {
	return (
		<SidebarStoreProvider storageKey={ADMIN_SIDEBAR_STORAGE_KEY} devtoolsName="Sidebar · test">
			<SidebarHarness {...props} />
			<SidebarStateProbe pathname={props.pathname} />
		</SidebarStoreProvider>
	);
}

/** A fresh sidebar store per render (as in the app: one per mounted shell). */
function renderSidebar(props: HarnessProps): ReturnType<typeof render> {
	return render(sidebarTree(props));
}

/** Types into the sidebar search and lets its debounce commit the text to the store. */
function searchFor(text: string): void {
	vi.useFakeTimers();
	try {
		fireEvent.change(screen.getByLabelText("Search menu"), { target: { value: text } });
		act(() => {
			vi.advanceTimersByTime(PANEL_SIDEBAR_SEARCH_DEBOUNCE_MS);
		});
	} finally {
		vi.useRealTimers();
	}
}

/** The leaf link for a page — leaves navigate, so they are links, not buttons. */
function link(name: string): HTMLElement {
	return screen.getByRole("link", { name });
}

describe("Sidebar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		harnessIsMobile = false;
		pathnameMock.mockReturnValue("/");
		localStorage.clear();
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("renders nested children inside an indented submenu branch", () => {
		renderSidebar({ pathname: "/settings/general" });
		expect(link("General")).toBeTruthy();
		const settings = screen.getByRole("button", { name: "Settings" });
		expect(settings.getAttribute("aria-expanded")).toBe("true");
		const group = document.getElementById(settings.getAttribute("aria-controls") ?? "");
		expect(group?.getAttribute("role")).toBe("group");
		expect(group?.contains(link("General"))).toBe(true);
	});

	it("renders the pinned section even while the sidebar search is active", () => {
		renderSidebar({
			pathname: "/",
			pinnedItems: [{ id: "main-settings-general", title: "General", url: "/settings/general", section: "Main", breadcrumb: ["Settings", "General"] }],
		});
		searchFor("settings");
		expect(screen.getByText("Pinned")).toBeTruthy();
		expect(screen.getAllByRole("link", { name: "General" }).length).toBeGreaterThan(0);
	});

	it("renders sections, bottom items, the footer action and the user row", () => {
		renderSidebar({ pathname: "/" });
		expect(screen.getByText("Main")).toBeTruthy();
		expect(screen.getByText("Docs")).toBeTruthy();
		expect(link("Overview")).toBeTruthy();
		// Two named navigation landmarks: the menu, and the footer's bottom items.
		expect(screen.getByRole("navigation", { name: "Main navigation" }).contains(link("Overview"))).toBe(true);
		expect(screen.getByRole("navigation", { name: "Account" }).contains(link("Support"))).toBe(true);
		// Footer action + user identity.
		expect(screen.getByRole("button", { name: "Report issue" })).toBeTruthy();
		expect(screen.getByText("ada@example.com")).toBeTruthy();
	});

	it("marks only the active page with aria-current, never its ancestors, and links every leaf to its URL", () => {
		pathnameMock.mockReturnValue("/settings/general");
		renderSidebar({ pathname: "/settings/general" });
		expect(link("General").getAttribute("aria-current")).toBe("page");
		expect(link("General").getAttribute("href")).toBe("/settings/general");
		// "/settings" is a route prefix, but the parent must not highlight
		// alongside its active child.
		expect(screen.getByRole("button", { name: "Settings" }).getAttribute("data-active")).toBeNull();
		// Unrelated items are not.
		expect(link("Overview").getAttribute("aria-current")).toBeNull();
	});

	it("gives every row its full title, so a truncated label can still be read", () => {
		renderSidebar({ pathname: "/settings/general" });
		expect(link("Getting Started").getAttribute("title")).toBe("Getting Started");
		expect(screen.getByRole("button", { name: "Docs Home" }).getAttribute("title")).toBe("Docs Home");
	});

	function expandedItems(): Readonly<Record<string, boolean>> {
		return z.record(z.string(), z.boolean()).parse(JSON.parse(screen.getByTestId("expanded-items").textContent));
	}

	it("auto-expands the active branch without writing the store, and lets the member collapse it on this page", () => {
		pathnameMock.mockReturnValue("/settings/general");
		renderSidebar({ pathname: "/settings/general" });
		// The route auto-expanded the branch…
		expect(expandedItems()["main-settings"]).toBe(true);
		// …but nothing was stored.
		expect(readSidebarState().expandedItems["main-settings"]).toBeUndefined();
		// A manual collapse of the active branch wins over auto-expansion.
		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		expect(expandedItems()["main-settings"]).toBe(false);
		expect(screen.getByRole("button", { name: "Settings" }).getAttribute("aria-expanded")).toBe("false");
	});

	it("keeps a page's manual expansions only on that page — no reset on mount or navigation", () => {
		const { rerender } = renderSidebar({ pathname: "/" });
		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		expect(expandedItems()["main-settings"]).toBe(true);

		rerender(sidebarTree({ pathname: "/docs" }));
		expect(expandedItems()["main-settings"]).toBeUndefined();

		rerender(sidebarTree({ pathname: "/" }));
		expect(expandedItems()["main-settings"]).toBe(true);
	});

	it("restores this page's manual expansions after a reload (the store restores after mount, nothing resets them)", () => {
		const first = renderSidebar({ pathname: "/" });
		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		first.unmount();

		renderSidebar({ pathname: "/" });
		expect(expandedItems()["main-settings"]).toBe(true);
	});

	it("renders a disabled parent as an unavailable row that does not toggle", () => {
		renderSidebar({ pathname: "/" });
		const analytics = screen.getByRole("button", { name: "Analytics" });
		expect(analytics.getAttribute("aria-disabled")).toBe("true");
		expect(analytics.getAttribute("title")).toBe(ADMIN_SIDEBAR_LABELS.itemUnavailableTitle);
		fireEvent.click(analytics);
		expect(analytics.getAttribute("aria-expanded")).toBe("false");
	});

	it("filters the tree by search and restores it on clear", () => {
		renderSidebar({ pathname: "/" });
		searchFor("security");
		// Only the Settings → Security branch survives…
		expect(link("Security")).toBeTruthy();
		expect(screen.queryByText("Overview")).toBeNull();
		expect(screen.queryByText("General")).toBeNull();
		expect(screen.queryByText("Getting Started")).toBeNull();
		// …and clearing brings everything back at once.
		fireEvent.click(screen.getByLabelText("Clear search"));
		expect(link("Overview")).toBeTruthy();
		expect(readSidebarState().searchQuery).toBe("");
		expect(screen.queryByLabelText("Clear search")).toBeNull();
	});

	it("shows the no-results state for a query with zero matches", () => {
		renderSidebar({ pathname: "/" });
		searchFor("zzz-no-match");
		expect(screen.getByText("No menu items found")).toBeTruthy();
	});

	it("focuses the search box when / is pressed outside a text field", () => {
		renderSidebar({ pathname: "/" });
		fireEvent.keyDown(window, { key: "/" });
		expect(document.activeElement).toBe(screen.getByLabelText("Search menu"));
	});

	it("does not hijack / while the user is typing in a text field", () => {
		renderSidebar({ pathname: "/" });
		const otherInput = document.createElement("input");
		document.body.appendChild(otherInput);
		otherInput.focus();
		fireEvent.keyDown(otherInput, { key: "/" });
		expect(document.activeElement).toBe(otherInput);
		otherInput.remove();
	});

	it("follows a leaf link and closes the mobile menu", () => {
		harnessIsMobile = true;
		renderSidebar({ pathname: "/" });
		expect(link("Support").getAttribute("href")).toBe("/support");
		fireEvent.click(link("Support"));
		expect(setOpenMobileMock).toHaveBeenCalledWith(false);
	});

	it("fires footer actions on click", () => {
		const onReportIssue = vi.fn();
		renderSidebar({ pathname: "/", onReportIssue });
		fireEvent.click(screen.getByRole("button", { name: "Report issue" }));
		expect(onReportIssue).toHaveBeenCalledTimes(1);
	});
});

describe("SidebarSectionHeader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		harnessIsMobile = false;
		localStorage.clear();
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
	});

	afterEach(() => {
		cleanup();
	});

	it("marks the section holding the active route by brightening the label", () => {
		pathnameMock.mockReturnValue("/docs/getting-started");
		renderSidebar({ pathname: "/docs/getting-started" });
		const docsLabel = screen.getByText("Docs");
		const mainLabel = screen.getByText("Main");
		// The active section's label carries the signal — nothing else (no bar,
		// no divider, no uppercase). Inactive labels stay in the muted gray.
		expect(docsLabel.closest("[data-sidebar-section-header]")?.getAttribute("data-active-section")).toBe("true");
		expect(mainLabel.closest("[data-sidebar-section-header]")?.getAttribute("data-active-section")).toBeNull();
		expect(docsLabel.classList.contains("text-sidebar-foreground")).toBe(true);
		expect(mainLabel.classList.contains("text-muted-foreground")).toBe(true);
	});

	it("moves a section up via its reorder button", () => {
		renderSidebar({ pathname: "/" });
		fireEvent.click(screen.getByRole("button", { name: "Move Docs section up" }));
		expect(readSidebarState().sectionOrder).toEqual(["Docs", "Main"]);
	});

	it("moves a section down via Alt+ArrowDown from its reorder button", () => {
		renderSidebar({ pathname: "/" });
		fireEvent.keyDown(screen.getByRole("button", { name: "Move Main section down" }), { key: "ArrowDown", altKey: true });
		expect(readSidebarState().sectionOrder).toEqual(["Docs", "Main"]);
	});

	it("ignores arrow keys without the Alt modifier", () => {
		renderSidebar({ pathname: "/" });
		fireEvent.keyDown(screen.getByRole("button", { name: "Move Main section down" }), { key: "ArrowDown" });
		expect(readSidebarState().sectionOrder).toBeNull();
	});
});

describe("Sidebar preferences persistence", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("migrates the rail and section order saved by an older build — dropping its unscoped expansions and never its search text", () => {
		// The envelope `zustand/persist` wrote before the sidebar became a feature store.
		localStorage.setItem(
			ADMIN_SIDEBAR_STORAGE_KEY,
			JSON.stringify({
				state: { isOpen: false, sectionOrder: ["Docs", "Main"], expandedItems: { "main-settings": true }, searchQuery: "security" },
				version: 0,
			}),
		);

		renderSidebar({ pathname: "/" });

		expect(readSidebarState()).toEqual({ isOpen: false, sectionOrder: ["Docs", "Main"], expandedItems: {}, searchQuery: "" });
	});

	it("ignores a corrupted payload and starts from the defaults", () => {
		localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, snapshot: { isOpen: "nope", sectionOrder: 42, manualExpansion: null } }));

		renderSidebar({ pathname: "/" });

		expect(readSidebarState()).toEqual({ isOpen: true, sectionOrder: null, expandedItems: {}, searchQuery: "" });
	});

	it("saves this page's expansions and the section order but never the search text", () => {
		renderSidebar({ pathname: "/" });

		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		fireEvent.click(screen.getByRole("button", { name: "Move Docs section up" }));
		searchFor("security");
		expect(readSidebarState().searchQuery).toBe("security");

		const stored = readStoredPreferences();
		expect(stored.snapshot).toMatchObject({ isOpen: true, sectionOrder: ["Docs", "Main"], manualExpansion: { pathname: "/", items: { "main-settings": true } } });
		expect(stored.snapshot).not.toHaveProperty("searchQuery");
	});
});

describe("Sidebar with the authorized admin menu", () => {
	beforeEach(() => {
		harnessIsMobile = false;
		localStorage.clear();
	});

	afterEach(() => {
		cleanup();
	});

	it("does not render Products without the product list permission", () => {
		const menu = filterCompiledSidebarMenu(SIDEBAR_MENU, [], { enabledFeatureFlags: [] });
		renderSidebar({ pathname: "/", menu });

		expect(screen.queryByRole("link", { name: "Products" })).toBeNull();
		expect(link("Overview")).toBeDefined();
	});

	it("renders Products when the product list permission is held", () => {
		const menu = filterCompiledSidebarMenu(SIDEBAR_MENU, [PERMISSION.PRODUCT.LIST], { enabledFeatureFlags: [] });
		renderSidebar({ pathname: "/", menu });

		expect(link("Products")).toBeDefined();
	});
});
