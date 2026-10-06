// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels } from "../lib/labels/ui-kit-labels";
import { createNoopSidebarStorage } from "../lib/sidebar/storage";
import { AppPanelShell } from "./app-panel-shell";
import { AppShellNotificationBell } from "./app-shell-notification-bell";
import { AppShellTopbar, AppShellTopbarSearch } from "./app-shell-topbar";
import { PanelShellContent } from "./panel-shell-content";
import { PanelSidebarHeader } from "./panel-sidebar-header";
import { SidebarProvider, SidebarTrigger } from "./sidebar";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";

const STORAGE = createNoopSidebarStorage();
const BRAND = { icon: null, title: "Acme" };

beforeEach((): void => {
	window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach((): void => {
	cleanup();
});

describe("AppShellTopbar", () => {
	it("names its search triggers from the appShellTopbarSearch family and forwards its ref", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		const onOpen = vi.fn();
		render(
			<SidebarProvider storage={STORAGE}>
				<AppShellTopbar ref={ref} brand={BRAND} search={{ placeholder: "Search…", onOpen }} />
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);

		expect(ref.current?.dataset.slot).toBe("app-shell-topbar");
		fireEvent.click(screen.getByRole("button", { name: UI_KIT_LABELS_EN.appShellTopbarSearch.desktopAriaLabel }));
		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.appShellTopbarSearch.mobileAriaLabel })).toBeTruthy();
	});

	it("search takes translated accessible names and forwards its ref to its layout-neutral wrapper", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<AppShellTopbarSearch ref={ref} placeholder="Rechercher…" onOpen={vi.fn()} mobileAriaLabel="Rechercher" desktopAriaLabel="Rechercher des pages" />, {
			wrapper: UiKitTestProviders,
		});

		expect(ref.current?.className).toContain("contents");
		expect(screen.getByRole("button", { name: "Rechercher des pages" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Rechercher" })).toBeTruthy();
	});
});

describe("AppShellNotificationBell", () => {
	it("shows the unread dot only when there is something unread, and forwards its ref to the bell", (): void => {
		const ref = React.createRef<SVGSVGElement>();
		const { rerender } = render(<AppShellNotificationBell ref={ref} unreadCount={0} />);
		expect(ref.current?.dataset.slot).toBe("app-shell-notification-bell");
		expect(document.querySelector("[data-slot='app-shell-notification-badge']")).toBeNull();

		rerender(<AppShellNotificationBell ref={ref} unreadCount={2} />);
		expect(document.querySelector("[data-slot='app-shell-notification-badge']")?.className).toContain("bg-destructive");
	});
});

describe("AppPanelShell", () => {
	it("forwards its ref and passes sidebar labels through to the provider", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		const labels = { toggleSidebar: "Basculer le menu" };
		render(
			<AppPanelShell ref={ref} sidebar={<span>Nav</span>} topbar={<SidebarTrigger />} sidebarLabels={labels}>
				<p>Page</p>
			</AppPanelShell>,
			{ wrapper: UiKitTestProviders },
		);

		expect(ref.current?.dataset.slot).toBe("app-panel-shell");
		expect(screen.getByText("Page")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Basculer le menu" })).toBeTruthy();
	});
});

describe("Panel shell parts", () => {
	it("forward their refs", (): void => {
		const contentRef = React.createRef<HTMLDivElement>();
		const headerRef = React.createRef<HTMLDivElement>();
		render(
			<SidebarProvider storage={STORAGE}>
				<PanelSidebarHeader ref={headerRef} title="Acme" icon={null} />
				<PanelShellContent ref={contentRef}>Body</PanelShellContent>
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);

		expect(headerRef.current?.dataset.slot).toBe("panel-sidebar-header");
		expect(contentRef.current?.dataset.slot).toBe("panel-shell-content");
	});
});

/** A label set whose shell-chrome families differ from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = {
	...UI_KIT_LABELS_EN,
	appShellTopbarSearch: { mobileAriaLabel: "Suchen", desktopAriaLabel: "Seiten durchsuchen" },
	sidebar: { ...UI_KIT_LABELS_EN.sidebar, toggleSidebar: "Seitenleiste umschalten" },
};

describe("appShellTopbarSearch labels", () => {
	it("reads the family from the nearest UiKitLabelsProvider", (): void => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<AppShellTopbarSearch placeholder="Suchen…" onOpen={vi.fn()} />
			</UiKitLabelsProvider>,
		);

		expect(screen.getByRole("button", { name: GERMAN_LABELS.appShellTopbarSearch.desktopAriaLabel })).toBeTruthy();
		expect(screen.getByRole("button", { name: GERMAN_LABELS.appShellTopbarSearch.mobileAriaLabel })).toBeTruthy();
	});

	it("lets one per-usage name win while the other still comes from the family", (): void => {
		render(<AppShellTopbarSearch placeholder="Search…" onOpen={vi.fn()} mobileAriaLabel="Find" />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("button", { name: "Find" })).toBeTruthy();
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.appShellTopbarSearch.desktopAriaLabel })).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", (): void => {
		expect(() => render(<AppShellTopbarSearch placeholder="Search…" onOpen={vi.fn()} />)).toThrow('"appShellTopbarSearch" labels');
	});
});

describe("AppPanelShell sidebar labels", () => {
	it("reads the sidebar family from the provider when no sidebarLabels are passed", (): void => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<AppPanelShell sidebar={<span>Nav</span>} topbar={<SidebarTrigger />}>
					<p>Page</p>
				</AppPanelShell>
			</UiKitLabelsProvider>,
		);

		expect(screen.getByRole("button", { name: GERMAN_LABELS.sidebar.toggleSidebar })).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", (): void => {
		expect(() =>
			render(
				<AppPanelShell sidebar={<span>Nav</span>} topbar={<SidebarTrigger />}>
					<p>Page</p>
				</AppPanelShell>,
			),
		).toThrow('"sidebar" labels');
	});
});
