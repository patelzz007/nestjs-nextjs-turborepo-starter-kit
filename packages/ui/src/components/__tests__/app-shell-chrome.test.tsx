// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../../lib/labels/en";
import type { UiKitLabels } from "../../lib/labels/ui-kit-labels";
import { createNoopSidebarStorage } from "../../lib/sidebar/storage";
import { AppPanelShell } from "../app-panel-shell";
import { AppShellNotificationBell, NOTIFICATION_BADGE_MAX, notificationBadgeText } from "../app-shell-notification-bell";
import { AppShellTopbar, AppShellTopbarSearch } from "../app-shell-topbar";
import { PanelShellContent } from "../panel-shell-content";
import { PanelSidebarHeader } from "../panel-sidebar-header";
import { SidebarProvider, SidebarTrigger } from "../sidebar";
import { UiKitLabelsProvider } from "../ui-kit-labels-provider";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";

const MANY_UNREAD = 120;
const NINE = 9;

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
		// The wide trigger is named by its visible placeholder (WCAG 2.5.3), the shortcut announced as one.
		const wide = screen.getByRole("button", { name: "Search…" });
		expect(wide.getAttribute("aria-keyshortcuts")).toBe("Meta+K Control+K");
		fireEvent.click(wide);
		expect(onOpen).toHaveBeenCalledTimes(1);
		expect(screen.getByRole("button", { name: UI_KIT_LABELS_EN.appShellTopbarSearch.mobileAriaLabel })).toBeTruthy();
	});

	it("search takes a translated placeholder and icon-button name, and forwards its ref to its layout-neutral wrapper", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<AppShellTopbarSearch ref={ref} placeholder="Rechercher…" onOpen={vi.fn()} mobileAriaLabel="Rechercher" />, {
			wrapper: UiKitTestProviders,
		});

		expect(ref.current?.className).toContain("contents");
		expect(screen.getByRole("button", { name: "Rechercher…" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Rechercher" })).toBeTruthy();
	});
});

describe("AppShellNotificationBell", () => {
	it("shows the unread count only when there is something unread, and forwards its ref to the bell", (): void => {
		const ref = React.createRef<SVGSVGElement>();
		const { rerender } = render(<AppShellNotificationBell ref={ref} unreadCount={0} />);
		expect(ref.current?.dataset.slot).toBe("app-shell-notification-bell");
		expect(document.querySelector("[data-slot='app-shell-notification-badge']")).toBeNull();

		rerender(<AppShellNotificationBell ref={ref} unreadCount={2} />);
		const badge = document.querySelector("[data-slot='app-shell-notification-badge']");
		expect(badge?.className).toContain("bg-destructive");
		expect(badge?.textContent).toBe("2");
		expect(badge?.getAttribute("aria-hidden")).toBe("true");
	});

	it("caps a long count so the pill keeps its size", (): void => {
		render(<AppShellNotificationBell unreadCount={MANY_UNREAD} />);
		expect(document.querySelector("[data-slot='app-shell-notification-badge']")?.textContent).toBe("99+");
		expect(notificationBadgeText(NOTIFICATION_BADGE_MAX)).toBe("99");
		expect(notificationBadgeText(MANY_UNREAD, NINE)).toBe("9+");
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
	appShellTopbarSearch: { mobileAriaLabel: "Suchen" },
	sidebar: { ...UI_KIT_LABELS_EN.sidebar, toggleSidebar: "Seitenleiste umschalten" },
};

describe("appShellTopbarSearch labels", () => {
	it("reads the family from the nearest UiKitLabelsProvider", (): void => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<AppShellTopbarSearch placeholder="Suchen…" onOpen={vi.fn()} />
			</UiKitLabelsProvider>,
		);

		expect(screen.getByRole("button", { name: "Suchen…" })).toBeTruthy();
		expect(screen.getByRole("button", { name: GERMAN_LABELS.appShellTopbarSearch.mobileAriaLabel })).toBeTruthy();
	});

	it("lets the icon button's per-usage name win, the wide trigger keeping its placeholder", (): void => {
		render(<AppShellTopbarSearch placeholder="Search…" onOpen={vi.fn()} mobileAriaLabel="Find" />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("button", { name: "Find" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Search…" })).toBeTruthy();
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
