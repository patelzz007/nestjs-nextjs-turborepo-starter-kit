// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { breadcrumbPageLabel, type BreadcrumbStatus } from "./breadcrumb-context";
import { PanelSidebarFooterNav, PanelSidebarNav, PanelSidebarRouteAnnouncer, type PanelSidebarPinnedItem } from "./panel-sidebar-nav";
import type { PanelSidebarLinkProps } from "./panel-sidebar-nav-item";
import { PANEL_SIDEBAR_SEARCH_DEBOUNCE_MS } from "./panel-sidebar-search";
import { SidebarProvider } from "./sidebar";
import { DEFAULT_SIDEBAR_LABELS, type PanelSidebarNavLabels } from "@workspace/ui/lib/sidebar/labels";
import { buildSidebarView, type SidebarMenuDataLike } from "@workspace/ui/lib/sidebar/menu-view";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar/storage";

/** The shell's mobile drawer, as `useSidebar()` reports it. */
const mobile = vi.hoisted(() => ({ isMobile: false, setOpenMobile: vi.fn<(open: boolean) => void>() }));

vi.mock("./sidebar", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./sidebar")>();
	return {
		...actual,
		useSidebar: (): ReturnType<typeof actual.useSidebar> => ({ ...actual.useSidebar(), isMobile: mobile.isMobile, setOpenMobile: mobile.setOpenMobile }),
	};
});

const LABELS: PanelSidebarNavLabels = {
	navigationAriaLabel: "Main navigation",
	secondaryNavigationAriaLabel: "Account",
	searchPlaceholder: "Search…",
	searchAriaLabel: "Search menu",
	clearSearchAriaLabel: "Clear search",
	noResultsTitle: "Nothing found",
	noResultsDescription: "Try again",
	pinnedSectionTitle: "Pinned",
	moveSectionUpTitle: "Up",
	moveSectionDownTitle: "Down",
	moveSectionUpAriaLabel: (title: string): string => `Move ${title} up`,
	moveSectionDownAriaLabel: (title: string): string => `Move ${title} down`,
	itemUnavailableTitle: "Unavailable right now",
	routeAnnouncement: (pageLabel: string): string => `Navigated to ${pageLabel}`,
};

const MENU: SidebarMenuDataLike = {
	sections: [
		{
			title: "Main",
			items: [
				{ id: "home", title: "Home", url: "/" },
				{ id: "settings", title: "Settings", url: "/settings", children: [{ id: "general", title: "General settings for the whole workspace", url: "/settings/general" }] },
				{ id: "billing", title: "Billing", url: "/billing", disabled: true },
			],
		},
	],
	bottomItems: [{ id: "account", title: "Account", url: "/account" }],
};

function TestLink({ href, children, ...props }: PanelSidebarLinkProps & { readonly href: string }): React.JSX.Element {
	return (
		<a href={href} {...props}>
			{children}
		</a>
	);
}

function renderLink(href: string): React.ReactElement<PanelSidebarLinkProps> {
	return <TestLink href={href} />;
}

function renderIcon(): React.ReactNode {
	return null;
}

interface HarnessProps {
	readonly pathname: string;
	readonly expandedItems?: Readonly<Record<string, boolean>>;
	readonly searchQuery?: string;
	readonly pinnedItems?: readonly PanelSidebarPinnedItem[];
	readonly onToggleExpand?: (itemId: string) => void;
	readonly onSearchQueryChange?: (query: string) => void;
}

function Harness({
	pathname,
	expandedItems = {},
	searchQuery = "",
	pinnedItems = [],
	onToggleExpand = vi.fn(),
	onSearchQueryChange = vi.fn(),
}: HarnessProps): React.JSX.Element {
	const view = buildSidebarView({ menu: MENU, pathname, sectionOrder: null, searchQuery });
	const merged = { ...view.routeState.autoExpandedItems, ...expandedItems };
	return (
		<SidebarProvider labels={DEFAULT_SIDEBAR_LABELS} storage={createNoopSidebarStorage()}>
			<PanelSidebarNav
				view={view}
				pathname={pathname}
				expandedItems={merged}
				onToggleExpand={onToggleExpand}
				renderLink={renderLink}
				renderIcon={renderIcon}
				searchQuery={searchQuery}
				onSearchQueryChange={onSearchQueryChange}
				pinnedItems={pinnedItems}
				onMoveSectionUp={vi.fn()}
				onMoveSectionDown={vi.fn()}
				labels={LABELS}
			/>
			<PanelSidebarFooterNav
				view={view}
				expandedItems={merged}
				onToggleExpand={onToggleExpand}
				renderLink={renderLink}
				renderIcon={renderIcon}
				searchQuery={searchQuery}
				labels={LABELS}
			/>
		</SidebarProvider>
	);
}

beforeEach((): void => {
	window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
});

describe("PanelSidebarNav", () => {
	it("renders the menu inside a named nav landmark and bottom items inside a second one", () => {
		render(<Harness pathname="/" />);

		expect(screen.getByRole("navigation", { name: "Main navigation" }).contains(screen.getByRole("link", { name: "Home" }))).toBe(true);
		expect(screen.getByRole("navigation", { name: "Account" }).contains(screen.getByRole("link", { name: "Account" }))).toBe(true);
	});

	it("renders navigating leaves as links with aria-current on the current page only", () => {
		render(<Harness pathname="/settings/general" />);

		const general = screen.getByRole("link", { name: "General settings for the whole workspace" });
		expect(general.getAttribute("href")).toBe("/settings/general");
		expect(general.getAttribute("aria-current")).toBe("page");
		expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
	});

	it("gives a truncated label its full text as the row title", () => {
		render(<Harness pathname="/settings/general" />);

		expect(screen.getByRole("link", { name: "General settings for the whole workspace" }).getAttribute("title")).toBe("General settings for the whole workspace");
	});

	it("renders branches as disclosure buttons that control their nested group", () => {
		const onToggleExpand = vi.fn<(itemId: string) => void>();
		render(<Harness pathname="/" onToggleExpand={onToggleExpand} />);

		const settings = screen.getByRole("button", { name: "Settings" });
		expect(settings.getAttribute("aria-expanded")).toBe("false");
		const group = document.getElementById(settings.getAttribute("aria-controls") ?? "");
		expect(group?.getAttribute("role")).toBe("group");
		fireEvent.click(settings);
		expect(onToggleExpand).toHaveBeenCalledWith("settings");
	});

	it("announces a disabled item as an unavailable link that never navigates", () => {
		render(<Harness pathname="/" />);

		const billing = screen.getByRole("link", { name: "Billing" });
		expect(billing.getAttribute("aria-disabled")).toBe("true");
		expect(billing.hasAttribute("href")).toBe(false);
		expect(billing.getAttribute("title")).toBe("Unavailable right now");
	});

	it("closes the mobile drawer when a link is followed, and leaves the desktop rail alone", () => {
		mobile.isMobile = true;
		render(<Harness pathname="/" />);
		fireEvent.click(screen.getByRole("link", { name: "Home" }));
		expect(mobile.setOpenMobile).toHaveBeenCalledWith(false);

		cleanup();
		mobile.setOpenMobile.mockClear();
		mobile.isMobile = false;
		render(<Harness pathname="/" />);
		fireEvent.click(screen.getByRole("link", { name: "Home" }));
		expect(mobile.setOpenMobile).not.toHaveBeenCalled();
	});

	it("renders pinned pages as links, a disabled pin as unavailable", () => {
		render(
			<Harness
				pathname="/billing"
				pinnedItems={[
					{ title: "Account", url: "/account" },
					{ title: "Reports", url: "/reports", disabled: true },
				]}
			/>,
		);

		expect(screen.getAllByRole("link", { name: "Account" }).some((element) => element.getAttribute("href") === "/account")).toBe(true);
		expect(screen.getByRole("link", { name: "Reports" }).getAttribute("aria-disabled")).toBe("true");
	});

	it("commits the search after the debounce, and clear commits at once", () => {
		vi.useFakeTimers();
		const onSearchQueryChange = vi.fn<(query: string) => void>();
		render(<Harness pathname="/" onSearchQueryChange={onSearchQueryChange} />);

		fireEvent.change(screen.getByLabelText("Search menu"), { target: { value: "bill" } });
		expect(onSearchQueryChange).not.toHaveBeenCalled();
		fireEvent.click(screen.getByLabelText("Clear search"));
		act(() => {
			vi.advanceTimersByTime(PANEL_SIDEBAR_SEARCH_DEBOUNCE_MS * 2);
		});

		expect(onSearchQueryChange).not.toHaveBeenCalledWith("bill");
		expect(screen.getByLabelText<HTMLInputElement>("Search menu").value).toBe("");
	});
});

describe("PanelSidebarRouteAnnouncer", () => {
	it("announces the resolved page label, never a raw URL segment", () => {
		const status: BreadcrumbStatus = { kind: "ready", items: [] };
		render(<PanelSidebarRouteAnnouncer pageLabel="Free coffee" labels={LABELS} />);

		expect(screen.getByRole("status").textContent).toBe("Navigated to Free coffee");
		expect(breadcrumbPageLabel(status)).toBeNull();
	});
});
