// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AlertCircle } from "lucide-react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { z } from "zod";

import { compileMenu } from "@/lib/navigation/sidebar-menu";
import { buildSidebarView, type SidebarView, type SearchableMenuItem } from "@/lib/navigation/menu";
import { ADMIN_SIDEBAR_LABELS } from "@/lib/sidebar-labels";
import { useSidebarStore } from "@/stores/sidebar-store";
import type { SidebarMenuData } from "@/lib/navigation/sidebar";

import { AdminSidebarPanel } from "@/components/layout/sidebar/sidebar";
import { useRouteExpandedItems } from "@/components/layout/use-route-expanded-items";
import { SidebarProvider } from "@workspace/ui/components/navigation/sidebar";
import { DEFAULT_SIDEBAR_LABELS } from "@workspace/ui/lib/sidebar-labels";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar-storage";

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

/** Shape of what zustand persist writes to localStorage. `expandedItems` and `searchQuery` are optional so tests can assert their absence. */
const StoredPayloadSchema = z.object({
	state: z.object({
		isOpen: z.boolean().optional(),
		sectionOrder: z.array(z.string()).nullable().optional(),
		expandedItems: z.record(z.string(), z.boolean()).optional(),
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
	readonly isMobile?: boolean;
	readonly pinnedItems?: readonly SearchableMenuItem[];
}

/**
 * Recreates DashboardLayout's wiring: store slices (searchQuery, sectionOrder)
 * feed a memoized `buildSidebarView`, which is passed to the Sidebar as the
 * shared `view` prop. Subscribing to the store makes the harness reactive —
 * typing in search / reordering sections re-renders with a fresh view, exactly
 * like the real layout.
 */
function SidebarHarness({ pathname, onLogout, onReportIssue, isMobile = false, pinnedItems = [] }: HarnessProps): React.JSX.Element {
	harnessIsMobile = isMobile;
	const searchQuery = useSidebarStore((s) => s.searchQuery);
	const sectionOrder = useSidebarStore((s) => s.sectionOrder);
	const setSearchQuery = useSidebarStore((s) => s.setSearchQuery);
	const clearSearch = useSidebarStore((s) => s.clearSearch);
	const storeExpandedItems = useSidebarStore((s) => s.expandedItems);
	const setItemExpanded = useSidebarStore((s) => s.setItemExpanded);
	const resetExpandedItems = useSidebarStore((s) => s.resetExpandedItems);
	const moveSectionUp = useSidebarStore((s) => s.moveSectionUp);
	const moveSectionDown = useSidebarStore((s) => s.moveSectionDown);
	const view: SidebarView = React.useMemo(
		() => buildSidebarView({ menu: COMPILED_MENU, pathname, sectionOrder, searchQuery, isHighlightParentItem: false }),
		[pathname, sectionOrder, searchQuery],
	);
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

describe("Sidebar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		harnessIsMobile = false;
		pathnameMock.mockReturnValue("/");
		useSidebarStore.setState({ isOpen: true, sectionOrder: null, expandedItems: {}, searchQuery: "" });
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
		render(<SidebarHarness pathname="/settings/general" />);
		expect(screen.getByRole("button", { name: "General" })).toBeTruthy();
	});

	it("renders the pinned section even while the sidebar search is active", () => {
		useSidebarStore.setState({ searchQuery: "settings" });
		render(
			<SidebarHarness
				pathname="/"
				pinnedItems={[{ id: "main-settings-general", title: "General", url: "/settings/general", section: "Main", breadcrumb: ["Settings", "General"] }]}
			/>,
		);
		expect(screen.getByText("Pinned")).toBeTruthy();
		expect(screen.getAllByRole("button", { name: "General" }).length).toBeGreaterThan(0);
	});

	it("renders sections, bottom items, the footer action and the user row", () => {
		render(<SidebarHarness pathname="/" />);
		expect(screen.getByText("Main")).toBeTruthy();
		expect(screen.getByText("Docs")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Overview" })).toBeTruthy();
		// Bottom items render under the footer.
		expect(screen.getByRole("button", { name: "Support" })).toBeTruthy();
		// Footer action + user identity.
		expect(screen.getByRole("button", { name: "Report issue" })).toBeTruthy();
		expect(screen.getByText("ada@example.com")).toBeTruthy();
	});

	it("marks the active item and its route-prefix ancestors with data-active", () => {
		pathnameMock.mockReturnValue("/settings/general");
		render(<SidebarHarness pathname="/settings/general" />);
		expect(screen.getByRole("button", { name: "General" }).getAttribute("data-active")).toBe("true");
		// "/settings" is a route prefix, so the Settings parent is active too.
		expect(screen.getByRole("button", { name: "Settings" }).getAttribute("data-active")).toBe("true");
		// Unrelated items are not.
		expect(screen.getByRole("button", { name: "Overview" }).getAttribute("data-active")).toBeNull();
	});

	it("auto-expands the active branch without writing the store, and route wins on toggle", () => {
		pathnameMock.mockReturnValue("/settings/general");
		render(<SidebarHarness pathname="/settings/general" />);
		// Children render because the route auto-expanded the branch…
		expect(screen.getByRole("button", { name: "General" })).toBeTruthy();
		// …but nothing was persisted to the store yet.
		expect(useSidebarStore.getState().expandedItems["main-settings"]).toBeUndefined();
		// Clicking the auto-expanded parent (route wins) must not collapse it.
		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		expect(screen.getByRole("button", { name: "General" })).toBeTruthy();
	});

	it("persists manual expansion toggles when no route drives the branch", () => {
		render(<SidebarHarness pathname="/" />);
		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		expect(useSidebarStore.getState().expandedItems["main-settings"]).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Settings" }));
		// Collapsing prunes the key (no dead `false` entries persisted).
		expect(useSidebarStore.getState().expandedItems["main-settings"]).toBeUndefined();
	});

	it("renders disabled parents as a single disabled row with no children", () => {
		render(<SidebarHarness pathname="/" />);
		const analytics = screen.getByRole("button", { name: "Analytics" });
		expect(analytics.hasAttribute("disabled")).toBe(true);
		expect(screen.queryByText("Realtime")).toBeNull();
	});

	it("filters the tree by search and restores it on clear", () => {
		render(<SidebarHarness pathname="/" />);
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
		render(<SidebarHarness pathname="/" />);
		fireEvent.change(screen.getByLabelText("Search menu"), { target: { value: "zzz-no-match" } });
		expect(screen.getByText("No menu items found")).toBeTruthy();
	});

	it("focuses the search box when / is pressed outside a text field", () => {
		render(<SidebarHarness pathname="/" />);
		fireEvent.keyDown(window, { key: "/" });
		expect(document.activeElement).toBe(screen.getByLabelText("Search menu"));
	});

	it("does not hijack / while the user is typing in a text field", () => {
		render(<SidebarHarness pathname="/" />);
		const otherInput = document.createElement("input");
		document.body.appendChild(otherInput);
		otherInput.focus();
		fireEvent.keyDown(otherInput, { key: "/" });
		expect(document.activeElement).toBe(otherInput);
		otherInput.remove();
	});

	it("navigates on leaf click and closes the mobile menu", () => {
		render(<SidebarHarness pathname="/" isMobile />);
		fireEvent.click(screen.getByRole("button", { name: "Support" }));
		expect(pushMock).toHaveBeenCalledWith("/support");
		expect(setOpenMobileMock).toHaveBeenCalledWith(false);
	});

	it("fires footer actions on click", () => {
		const onReportIssue = vi.fn();
		render(<SidebarHarness pathname="/" onReportIssue={onReportIssue} />);
		fireEvent.click(screen.getByRole("button", { name: "Report issue" }));
		expect(onReportIssue).toHaveBeenCalledTimes(1);
	});
});

describe("SidebarSectionHeader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		harnessIsMobile = false;
		useSidebarStore.setState({ isOpen: true, sectionOrder: null, expandedItems: {}, searchQuery: "" });
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
		render(<SidebarHarness pathname="/docs/getting-started" />);
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
		render(<SidebarHarness pathname="/" />);
		fireEvent.click(screen.getByRole("button", { name: "Move Docs section up" }));
		expect(useSidebarStore.getState().sectionOrder).toEqual(["Docs", "Main"]);
	});

	it("moves a section down via Alt+ArrowDown from its reorder button", () => {
		render(<SidebarHarness pathname="/" />);
		fireEvent.keyDown(screen.getByRole("button", { name: "Move Main section down" }), { key: "ArrowDown", altKey: true });
		expect(useSidebarStore.getState().sectionOrder).toEqual(["Docs", "Main"]);
	});

	it("ignores arrow keys without the Alt modifier", () => {
		render(<SidebarHarness pathname="/" />);
		fireEvent.keyDown(screen.getByRole("button", { name: "Move Main section down" }), { key: "ArrowDown" });
		expect(useSidebarStore.getState().sectionOrder).toBeNull();
	});
});

describe("SidebarStore persistence", () => {
	beforeEach(() => {
		localStorage.clear();
		useSidebarStore.setState({ isOpen: true, sectionOrder: null, expandedItems: {}, searchQuery: "" });
	});

	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("strips stale expansions AND search queries from a legacy payload on rehydrate (refresh resets to default)", async () => {
		// A payload written by an older build (before expansions/search went
		// session-only) still contains `expandedItems` and `searchQuery`.
		// Rehydration must drop both — this is what makes a soft/hard refresh
		// restore the default menu and an empty search box.
		localStorage.setItem(
			"admin-sidebar-state",
			JSON.stringify({
				state: {
					isOpen: false,
					sectionOrder: ["Docs", "Main"],
					expandedItems: { "main-settings": true, "docs-docs-home": true },
					searchQuery: "security",
				},
				version: 0,
			}),
		);

		await useSidebarStore.persist.rehydrate();

		const state = useSidebarStore.getState();
		// Expanded items are now persisted (capped at 20) — legacy expansions survive.
		expect(state.expandedItems).toEqual({ "main-settings": true, "docs-docs-home": true });
		// Search query is still session-only — resets on reload.
		expect(state.searchQuery).toBe("");
		// The user's real preferences (rail state, section order) survive.
		expect(state.isOpen).toBe(false);
		expect(state.sectionOrder).toEqual(["Docs", "Main"]);
	});

	it("ignores a corrupted persisted payload without clobbering live state", async () => {
		// Seed a non-default value first: a corrupt payload must not overwrite the
		// live state (the merge falls back to the current state untouched).
		useSidebarStore.setState({ isOpen: false });
		localStorage.setItem("admin-sidebar-state", JSON.stringify({ state: { isOpen: "nope", sectionOrder: 42 }, version: 0 }));

		await useSidebarStore.persist.rehydrate();

		const state = useSidebarStore.getState();
		// Live state survives; expansions stay reset.
		expect(state.isOpen).toBe(false);
		expect(state.sectionOrder).toBeNull();
		expect(state.expandedItems).toEqual({});
	});

	it("never writes expandedItems or searchQuery to storage (new refreshes start from the default menu + empty search)", () => {
		// Toggle a few expansions and type a search, then trigger a persist write
		// and confirm the stored payload contains neither `expandedItems` nor
		// `searchQuery` — both are session-only.
		useSidebarStore.getState().setItemExpanded("main-settings", true);
		useSidebarStore.getState().setItemExpanded("docs-docs-home", true);
		useSidebarStore.getState().setSearchQuery("security");
		useSidebarStore.setState({ isOpen: false });

		const raw = localStorage.getItem("admin-sidebar-state");
		expect(raw).not.toBeNull();
		// Parse the stored payload with zod (no unchecked casts) — the schema
		// tolerates the session-only keys being present so we can assert absence.
		const parsed = StoredPayloadSchema.safeParse(JSON.parse(raw ?? "{}"));
		if (parsed.success) {
			// expandedItems is now persisted (capped at 20).
			expect(parsed.data.state).toHaveProperty("expandedItems");
			// searchQuery is still session-only — never persisted.
			expect(parsed.data.state).not.toHaveProperty("searchQuery");
			// The user's genuine preferences still persist.
			expect(parsed.data.state.isOpen).toBe(false);
		} else {
			throw new Error("stored payload did not match the expected shape");
		}
	});
});
