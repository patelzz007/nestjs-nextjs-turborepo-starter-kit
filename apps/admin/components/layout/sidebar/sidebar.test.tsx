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
import { useRouteExpandedItems } from "@/components/layout/use-route-expanded-items";
import { SidebarProvider } from "@workspace/ui/components/navigation/sidebar";
import { DEFAULT_SIDEBAR_LABELS } from "@workspace/ui/lib/sidebar/labels";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar/storage";

const { pushMock, pathnameMock, setOpenMobileMock } = vi.hoisted(() => ({
	pushMock: vi.fn<(href: string) => void>(),
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
	useRouter: (): {
		push: typeof pushMock;
		back: ReturnType<typeof vi.fn>;
		forward: ReturnType<typeof vi.fn>;
		refresh: ReturnType<typeof vi.fn>;
		prefetch: ReturnType<typeof vi.fn>;
		replace: ReturnType<typeof vi.fn>;
	} => ({
		push: pushMock,
		back: vi.fn(),
		forward: vi.fn(),
		refresh: vi.fn(),
		prefetch: vi.fn(),
		replace: vi.fn(),
	}),
}));

/** What the probe renders: the sidebar store state, read through the facade like any component would. */
const SidebarStateSchema = z.object({
	isOpen: z.boolean(),
	sectionOrder: z.array(z.string()).nullable(),
	expandedItems: z.record(z.string(), z.boolean()),
	searchQuery: z.string(),
});

/** What the store writes to localStorage — `searchQuery` optional so tests can assert its absence. */
const StoredPreferencesSchema = z.object({
	isOpen: z.boolean(),
	sectionOrder: z.array(z.string()).nullable(),
	expandedItems: z.record(z.string(), z.boolean()),
	searchQuery: z.string().optional(),
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
	const storeExpandedItems = useSidebarExpandedItems();
	const { setSearchQuery, clearSearch, setItemExpanded, resetExpandedItems, moveSectionUp, moveSectionDown } = useSidebarCommands();
	const view: SidebarView = React.useMemo(() => buildSidebarView({ menu, pathname, sectionOrder, searchQuery }), [menu, pathname, sectionOrder, searchQuery]);
	const expandedItems = useRouteExpandedItems(pathname, storeExpandedItems, view.routeState.autoExpandedItems, resetExpandedItems);
	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setSearchQuery(event.target.value);
		},
		[setSearchQuery],
	);
	const handleToggleItem = React.useCallback(
		(itemId: string): void => {
			setItemExpanded(itemId, !(expandedItems[itemId] ?? false));
		},
		[expandedItems, setItemExpanded],
	);
	const handleNavigate = React.useCallback((href: string): void => {
		pushMock(href);
	}, []);

	return (
		<SidebarProvider labels={DEFAULT_SIDEBAR_LABELS} storage={createNoopSidebarStorage()}>
			<AdminSidebarPanel
				user={{ name: "Ada Lovelace", email: "ada@example.com" }}
				onLogout={onLogout ?? vi.fn()}
				footerActions={[{ icon: AlertCircle, label: "Report issue", onClick: onReportIssue ?? vi.fn() }]}
				view={view}
				labels={ADMIN_SIDEBAR_LABELS}
				searchQuery={searchQuery}
				onSearchChange={handleSearchChange}
				onClearSearch={clearSearch}
				expandedItems={expandedItems}
				onToggleItem={handleToggleItem}
				onNavigate={handleNavigate}
				onMoveSectionUp={moveSectionUp}
				onMoveSectionDown={moveSectionDown}
				pinnedItems={pinnedItems}
				workspaces={[{ id: "default", name: "Admin Panel" }]}
				activeWorkspaceId="default"
				onWorkspaceChange={vi.fn()}
				navigationKey={pathname}
			/>
		</SidebarProvider>
	);
}

/** Renders the store state as JSON, so tests assert on it without reaching into the store. */
function SidebarStateProbe(): React.JSX.Element {
	const state = { isOpen: useSidebarIsOpen(), sectionOrder: useSidebarSectionOrder(), expandedItems: useSidebarExpandedItems(), searchQuery: useSidebarSearchQuery() };
	return <output data-testid="sidebar-state">{JSON.stringify(state)}</output>;
}

function readSidebarState(): z.output<typeof SidebarStateSchema> {
	return SidebarStateSchema.parse(JSON.parse(screen.getByTestId("sidebar-state").textContent));
}

function readStoredPreferences(): z.output<typeof StoredPreferencesSchema> {
	return StoredPreferencesSchema.parse(JSON.parse(localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) ?? "null"));
}

/** A fresh sidebar store per render (as in the app: one per mounted shell). */
function renderSidebar(props: HarnessProps): ReturnType<typeof render> {
	return render(
		<SidebarStoreProvider storageKey={ADMIN_SIDEBAR_STORAGE_KEY} devtoolsName="Sidebar · test">
			<SidebarHarness {...props} />
			<SidebarStateProbe />
		</SidebarStoreProvider>,
	);
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
		expect(screen.getByRole("button", { name: "General" })).toBeTruthy();
	});

	it("renders the pinned section even while the sidebar search is active", () => {
		renderSidebar({
			pathname: "/",
			pinnedItems: [{ id: "main-settings-general", title: "General", url: "/settings/general", section: "Main", breadcrumb: ["Settings", "General"] }],
		});
		fireEvent.change(screen.getByLabelText("Search menu"), { target: { value: "settings" } });
		expect(screen.getByText("Pinned")).toBeTruthy();
		expect(screen.getAllByRole("button", { name: "General" }).length).toBeGreaterThan(0);
	});

	it("renders sections, bottom items, the footer action and the user row", () => {
		renderSidebar({ pathname: "/" });
		expect(screen.getByText("Main")).toBeTruthy();
		expect(screen.getByText("Docs")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
		// Bottom items render under the footer.
		expect(screen.getByRole("button", { name: "Support" })).toBeTruthy();
		// Footer action + user identity.
		expect(screen.getByRole("button", { name: "Report issue" })).toBeTruthy();
		expect(screen.getByText("ada@example.com")).toBeTruthy();
	});

	it("marks only the active item with data-active, never its ancestors", () => {
		pathnameMock.mockReturnValue("/settings/general");
		renderSidebar({ pathname: "/settings/general" });
		expect(screen.getByRole("button", { name: "General" }).getAttribute("data-active")).toBe("true");
		// "/settings" is a route prefix, but the parent must not highlight
		// alongside its active child.
		expect(screen.getByRole("button", { name: "Settings" }).getAttribute("data-active")).toBeNull();
		// Unrelated items are not.
		expect(screen.getByRole("button", { name: "Overview" }).getAttribute("data-active")).toBeNull();
	});

	it("auto-expands the active branch without writing the store, and route wins on toggle", () => {
		pathnameMock.mockReturnValue("/settings/general");
		renderSidebar({ pathname: "/settings/general" });
		// Children render because the route auto-expanded the branch…
		expect(screen.getByRole("button", { name: "General" })).toBeTruthy();
		// …but nothing was persisted to the store yet.
		expect(readSidebarState().expandedItems["main-settings"]).toBeUndefined();
		// Clicking the auto-expanded parent (route wins) must not collapse it.
		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		expect(screen.getByRole("button", { name: "General" })).toBeTruthy();
	});

	it("persists manual expansion toggles when no route drives the branch", () => {
		renderSidebar({ pathname: "/" });
		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		expect(readSidebarState().expandedItems["main-settings"]).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		// Collapsing prunes the key (no dead `false` entries persisted).
		expect(readSidebarState().expandedItems["main-settings"]).toBeUndefined();
	});

	it("renders disabled parents as a single disabled row with no children", () => {
		renderSidebar({ pathname: "/" });
		const analytics = screen.getByRole("button", { name: "Analytics" });
		expect(analytics.hasAttribute("disabled")).toBe(true);
		expect(screen.queryByText("Realtime")).toBeNull();
	});

	it("filters the tree by search and restores it on clear", () => {
		renderSidebar({ pathname: "/" });
		fireEvent.change(screen.getByLabelText("Search menu"), { target: { value: "security" } });
		// Only the Settings → Security branch survives…
		expect(screen.getByRole("button", { name: "Security" })).toBeTruthy();
		expect(screen.queryByText("Overview")).toBeNull();
		expect(screen.queryByText("General")).toBeNull();
		expect(screen.queryByText("Getting Started")).toBeNull();
		// …and clearing brings everything back.
		fireEvent.click(screen.getByLabelText("Clear search"));
		expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
		expect(screen.queryByLabelText("Clear search")).toBeNull();
	});

	it("shows the no-results state for a query with zero matches", () => {
		renderSidebar({ pathname: "/" });
		fireEvent.change(screen.getByLabelText("Search menu"), { target: { value: "zzz-no-match" } });
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

	it("navigates on leaf click and closes the mobile menu", () => {
		harnessIsMobile = true;
		renderSidebar({ pathname: "/" });
		fireEvent.click(screen.getByRole("button", { name: "Support" }));
		expect(pushMock).toHaveBeenCalledWith("/support");
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

	it("restores the rail, section order and expansions saved by an older build — never its search text", () => {
		// The envelope `zustand/persist` wrote before the sidebar became a feature store.
		localStorage.setItem(
			ADMIN_SIDEBAR_STORAGE_KEY,
			JSON.stringify({
				state: { isOpen: false, sectionOrder: ["Docs", "Main"], expandedItems: { "main-settings": true }, searchQuery: "security" },
				version: 0,
			}),
		);

		renderSidebar({ pathname: "/" });

		expect(readSidebarState()).toEqual({ isOpen: false, sectionOrder: ["Docs", "Main"], expandedItems: { "main-settings": true }, searchQuery: "" });
	});

	it("ignores a corrupted payload and starts from the defaults", () => {
		localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, JSON.stringify({ isOpen: "nope", sectionOrder: 42, expandedItems: {} }));

		renderSidebar({ pathname: "/" });

		expect(readSidebarState()).toEqual({ isOpen: true, sectionOrder: null, expandedItems: {}, searchQuery: "" });
	});

	it("saves expansions and section order but never the search text", () => {
		renderSidebar({ pathname: "/" });

		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		fireEvent.click(screen.getByRole("button", { name: "Move Docs section up" }));
		act(() => {
			fireEvent.change(screen.getByLabelText("Search menu"), { target: { value: "security" } });
		});

		const stored = readStoredPreferences();
		expect(stored).toMatchObject({ isOpen: true, sectionOrder: ["Docs", "Main"], expandedItems: { "main-settings": true } });
		expect(stored).not.toHaveProperty("searchQuery");
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

		expect(screen.queryByRole("button", { name: "Products" })).toBeNull();
		expect(screen.getByRole("button", { name: "Overview" })).toBeDefined();
	});

	it("renders Products when the product list permission is held", () => {
		const menu = filterCompiledSidebarMenu(SIDEBAR_MENU, [PERMISSION.PRODUCT.LIST], { enabledFeatureFlags: [] });
		renderSidebar({ pathname: "/", menu });

		expect(screen.getByRole("button", { name: "Products" })).toBeDefined();
	});
});
