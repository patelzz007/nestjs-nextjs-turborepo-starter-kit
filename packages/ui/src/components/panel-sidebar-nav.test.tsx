// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { breadcrumbPageLabel, type BreadcrumbStatus } from "./breadcrumb-context";
import { PanelSidebarFooterNav, PanelSidebarNav, PanelSidebarRouteAnnouncer, type PanelSidebarPinnedItem } from "./panel-sidebar-nav";
import type { PanelSidebarLinkProps } from "./panel-sidebar-nav-item";
import { PANEL_SIDEBAR_SEARCH_DEBOUNCE_MS } from "./panel-sidebar-search";
import { SidebarProvider } from "./sidebar";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import type { UiKitLabels, UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
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

const EN = UI_KIT_LABELS_EN.panelSidebarNav;

/** A per-usage override of two strings — the rest must still come from the family. */
const PARTIAL_OVERRIDE = {
	navigationAriaLabel: "Navigation principale",
	itemUnavailableTitle: "Indisponible pour le moment",
} satisfies UiKitLabelsOverride<"panelSidebarNav">;

/** A label set whose `panelSidebarNav` family differs from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = {
	...UI_KIT_LABELS_EN,
	panelSidebarNav: {
		...UI_KIT_LABELS_EN.panelSidebarNav,
		navigationAriaLabel: "Hauptnavigation",
		secondaryNavigationAriaLabel: "Konto",
		routeAnnouncement: (pageLabel: string): string => `Navigiert zu ${pageLabel}`,
	},
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
	readonly labels?: UiKitLabelsOverride<"panelSidebarNav">;
}

function Harness({
	pathname,
	expandedItems = {},
	searchQuery = "",
	pinnedItems = [],
	onToggleExpand = vi.fn(),
	onSearchQueryChange = vi.fn(),
	labels,
}: HarnessProps): React.JSX.Element {
	const view = buildSidebarView({ menu: MENU, pathname, sectionOrder: null, searchQuery });
	const merged = { ...view.routeState.autoExpandedItems, ...expandedItems };
	return (
		<SidebarProvider storage={createNoopSidebarStorage()}>
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
				labels={labels}
			/>
			<PanelSidebarFooterNav
				view={view}
				expandedItems={merged}
				onToggleExpand={onToggleExpand}
				renderLink={renderLink}
				renderIcon={renderIcon}
				searchQuery={searchQuery}
				labels={labels}
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
		render(<Harness pathname="/" />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("navigation", { name: EN.navigationAriaLabel }).contains(screen.getByRole("link", { name: "Home" }))).toBe(true);
		expect(screen.getByRole("navigation", { name: EN.secondaryNavigationAriaLabel }).contains(screen.getByRole("link", { name: "Account" }))).toBe(true);
	});

	it("renders navigating leaves as links with aria-current on the current page only", () => {
		render(<Harness pathname="/settings/general" />, { wrapper: UiKitTestProviders });

		const general = screen.getByRole("link", { name: "General settings for the whole workspace" });
		expect(general.getAttribute("href")).toBe("/settings/general");
		expect(general.getAttribute("aria-current")).toBe("page");
		expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
	});

	it("gives a truncated label its full text as the row title", () => {
		render(<Harness pathname="/settings/general" />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("link", { name: "General settings for the whole workspace" }).getAttribute("title")).toBe("General settings for the whole workspace");
	});

	it("renders branches as disclosure buttons that control their nested group", () => {
		const onToggleExpand = vi.fn<(itemId: string) => void>();
		render(<Harness pathname="/" onToggleExpand={onToggleExpand} />, { wrapper: UiKitTestProviders });

		const settings = screen.getByRole("button", { name: "Settings" });
		expect(settings.getAttribute("aria-expanded")).toBe("false");
		const group = document.getElementById(settings.getAttribute("aria-controls") ?? "");
		expect(group?.getAttribute("role")).toBe("group");
		fireEvent.click(settings);
		expect(onToggleExpand).toHaveBeenCalledWith("settings");
	});

	it("announces a disabled item as an unavailable link that never navigates", () => {
		render(<Harness pathname="/" />, { wrapper: UiKitTestProviders });

		const billing = screen.getByRole("link", { name: "Billing" });
		expect(billing.getAttribute("aria-disabled")).toBe("true");
		expect(billing.hasAttribute("href")).toBe(false);
		expect(billing.getAttribute("title")).toBe(EN.itemUnavailableTitle);
	});

	it("closes the mobile drawer when a link is followed, and leaves the desktop rail alone", () => {
		mobile.isMobile = true;
		render(<Harness pathname="/" />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("link", { name: "Home" }));
		expect(mobile.setOpenMobile).toHaveBeenCalledWith(false);

		cleanup();
		mobile.setOpenMobile.mockClear();
		mobile.isMobile = false;
		render(<Harness pathname="/" />, { wrapper: UiKitTestProviders });
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
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getAllByRole("link", { name: "Account" }).some((element) => element.getAttribute("href") === "/account")).toBe(true);
		expect(screen.getByRole("link", { name: "Reports" }).getAttribute("aria-disabled")).toBe("true");
	});

	it("commits the search after the debounce, and clear commits at once", () => {
		vi.useFakeTimers();
		const onSearchQueryChange = vi.fn<(query: string) => void>();
		render(<Harness pathname="/" onSearchQueryChange={onSearchQueryChange} />, { wrapper: UiKitTestProviders });

		fireEvent.change(screen.getByLabelText(EN.searchAriaLabel), { target: { value: "bill" } });
		expect(onSearchQueryChange).not.toHaveBeenCalled();
		fireEvent.click(screen.getByLabelText(EN.clearSearchAriaLabel));
		act(() => {
			vi.advanceTimersByTime(PANEL_SIDEBAR_SEARCH_DEBOUNCE_MS * 2);
		});

		expect(onSearchQueryChange).not.toHaveBeenCalledWith("bill");
		expect(screen.getByLabelText<HTMLInputElement>(EN.searchAriaLabel).value).toBe("");
	});
});

describe("PanelSidebarRouteAnnouncer", () => {
	it("announces the resolved page label, never a raw URL segment", () => {
		const status: BreadcrumbStatus = { kind: "ready", items: [] };
		render(<PanelSidebarRouteAnnouncer pageLabel="Free coffee" />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("status").textContent).toBe(EN.routeAnnouncement("Free coffee"));
		expect(breadcrumbPageLabel(status)).toBeNull();
	});
});

describe("panelSidebarNav labels", () => {
	it("reads the family from the nearest UiKitLabelsProvider", () => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<Harness pathname="/" />
				<PanelSidebarRouteAnnouncer pageLabel="Startseite" />
			</UiKitLabelsProvider>,
		);

		expect(screen.getByRole("navigation", { name: GERMAN_LABELS.panelSidebarNav.navigationAriaLabel })).toBeTruthy();
		expect(screen.getByRole("navigation", { name: GERMAN_LABELS.panelSidebarNav.secondaryNavigationAriaLabel })).toBeTruthy();
		expect(screen.getByText(GERMAN_LABELS.panelSidebarNav.routeAnnouncement("Startseite"))).toBeTruthy();
	});

	it("lays a partial labels prop over the family for this usage only", () => {
		render(<Harness pathname="/" labels={PARTIAL_OVERRIDE} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("navigation", { name: PARTIAL_OVERRIDE.navigationAriaLabel })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Billing" }).getAttribute("title")).toBe(PARTIAL_OVERRIDE.itemUnavailableTitle);
		// Strings the override leaves out still come from the family.
		expect(screen.getByLabelText(EN.searchAriaLabel)).toBeTruthy();
		expect(screen.getByRole("navigation", { name: EN.secondaryNavigationAriaLabel })).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", () => {
		expect(() => render(<PanelSidebarRouteAnnouncer pageLabel="Home" />)).toThrow('"panelSidebarNav" labels');
	});
});
