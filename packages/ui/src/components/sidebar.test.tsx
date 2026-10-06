// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels } from "../lib/labels/ui-kit-labels";
import { createNoopSidebarStorage } from "../lib/sidebar/storage";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
} from "./sidebar";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";

const STORAGE = createNoopSidebarStorage();

/** Viewport the stubbed `matchMedia` reports: `true` = below the `lg` breakpoint. */
let mobileViewport = false;

beforeEach((): void => {
	mobileViewport = false;
	window.matchMedia = vi.fn().mockImplementation(() => ({ matches: mobileViewport, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach((): void => {
	cleanup();
});

function MobileState(): React.JSX.Element {
	const { openMobile } = useSidebar();
	return <output data-testid="open-mobile">{String(openMobile)}</output>;
}

describe("SidebarProvider", () => {
	it("is controlled by openMobile / onOpenMobileChange: the trigger reports, the parent decides", (): void => {
		mobileViewport = true;
		const onOpenMobileChange = vi.fn();
		render(
			<SidebarProvider storage={STORAGE} openMobile={false} onOpenMobileChange={onOpenMobileChange}>
				<SidebarTrigger />
				<MobileState />
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);

		fireEvent.click(screen.getByRole("button", { name: UI_KIT_LABELS_EN.sidebar.toggleSidebar }));

		expect(onOpenMobileChange).toHaveBeenCalledWith(true);
		expect(screen.getByTestId("open-mobile").textContent).toBe("false");
	});

	it("owns the mobile sheet state when uncontrolled", (): void => {
		mobileViewport = true;
		render(
			<SidebarProvider storage={STORAGE}>
				<SidebarTrigger />
				<MobileState />
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);

		fireEvent.click(screen.getByRole("button", { name: UI_KIT_LABELS_EN.sidebar.toggleSidebar }));

		expect(screen.getByTestId("open-mobile").textContent).toBe("true");
	});
});

describe("Sidebar parts", () => {
	it("forward their refs to their own elements", (): void => {
		const refs = {
			sidebar: React.createRef<HTMLDivElement>(),
			header: React.createRef<HTMLDivElement>(),
			input: React.createRef<HTMLInputElement>(),
			content: React.createRef<HTMLDivElement>(),
			group: React.createRef<HTMLDivElement>(),
			groupLabel: React.createRef<HTMLDivElement>(),
			groupAction: React.createRef<HTMLButtonElement>(),
			groupContent: React.createRef<HTMLDivElement>(),
			menu: React.createRef<HTMLUListElement>(),
			menuItem: React.createRef<HTMLLIElement>(),
			menuButton: React.createRef<HTMLButtonElement>(),
			menuAction: React.createRef<HTMLButtonElement>(),
			menuBadge: React.createRef<HTMLDivElement>(),
			menuSkeleton: React.createRef<HTMLDivElement>(),
			menuSub: React.createRef<HTMLUListElement>(),
			menuSubItem: React.createRef<HTMLLIElement>(),
			menuSubButton: React.createRef<HTMLAnchorElement>(),
			separator: React.createRef<HTMLDivElement>(),
			footer: React.createRef<HTMLDivElement>(),
		};
		render(
			<SidebarProvider storage={STORAGE}>
				<Sidebar ref={refs.sidebar} collapsible="none">
					<SidebarHeader ref={refs.header}>
						<SidebarInput ref={refs.input} aria-label="Filter" />
					</SidebarHeader>
					<SidebarContent ref={refs.content}>
						<SidebarGroup ref={refs.group}>
							<SidebarGroupLabel ref={refs.groupLabel}>Group</SidebarGroupLabel>
							<SidebarGroupAction ref={refs.groupAction} aria-label="Add" />
							<SidebarGroupContent ref={refs.groupContent}>
								<SidebarMenu ref={refs.menu}>
									<SidebarMenuItem ref={refs.menuItem}>
										<SidebarMenuButton ref={refs.menuButton}>Home</SidebarMenuButton>
										<SidebarMenuAction ref={refs.menuAction} aria-label="More" />
										<SidebarMenuBadge ref={refs.menuBadge}>3</SidebarMenuBadge>
										<SidebarMenuSub ref={refs.menuSub}>
											<SidebarMenuSubItem ref={refs.menuSubItem}>
												<SidebarMenuSubButton ref={refs.menuSubButton} href="/a">
													A
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										</SidebarMenuSub>
									</SidebarMenuItem>
								</SidebarMenu>
								<SidebarMenuSkeleton ref={refs.menuSkeleton} />
							</SidebarGroupContent>
						</SidebarGroup>
						<SidebarSeparator ref={refs.separator} />
					</SidebarContent>
					<SidebarFooter ref={refs.footer} />
				</Sidebar>
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);

		expect(refs.sidebar.current?.dataset.slot).toBe("sidebar");
		expect(refs.header.current?.dataset.slot).toBe("sidebar-header");
		expect(refs.input.current?.tagName).toBe("INPUT");
		expect(refs.content.current?.dataset.slot).toBe("sidebar-content");
		expect(refs.group.current?.dataset.slot).toBe("sidebar-group");
		expect(refs.groupLabel.current?.dataset.slot).toBe("sidebar-group-label");
		expect(refs.groupAction.current?.dataset.slot).toBe("sidebar-group-action");
		expect(refs.groupContent.current?.dataset.slot).toBe("sidebar-group-content");
		expect(refs.menu.current?.dataset.slot).toBe("sidebar-menu");
		expect(refs.menuItem.current?.dataset.slot).toBe("sidebar-menu-item");
		expect(refs.menuButton.current?.dataset.slot).toBe("sidebar-menu-button");
		expect(refs.menuAction.current?.dataset.slot).toBe("sidebar-menu-action");
		expect(refs.menuBadge.current?.dataset.slot).toBe("sidebar-menu-badge");
		expect(refs.menuSkeleton.current?.dataset.slot).toBe("sidebar-menu-skeleton");
		expect(refs.menuSub.current?.dataset.slot).toBe("sidebar-menu-sub");
		expect(refs.menuSubItem.current?.dataset.slot).toBe("sidebar-menu-sub-item");
		expect(refs.menuSubButton.current?.dataset.slot).toBe("sidebar-menu-sub-button");
		expect(refs.separator.current?.dataset.slot).toBe("sidebar-separator");
		expect(refs.footer.current?.dataset.slot).toBe("sidebar-footer");
	});
});

/** A label set whose `sidebar` family differs from English — proves the provider, not a built-in default, supplies the copy. */
const GERMAN_SIDEBAR_LABELS: UiKitLabels = {
	...UI_KIT_LABELS_EN,
	sidebar: { toggleSidebar: "Seitenleiste umschalten", mobileTitle: "Seitenleiste", mobileDescription: "Zeigt die mobile Seitenleiste." },
};

const TOGGLE_OVERRIDE = { toggleSidebar: "Basculer le menu" };

describe("SidebarProvider labels", () => {
	it("reads the sidebar family from the nearest UiKitLabelsProvider", (): void => {
		render(
			<UiKitLabelsProvider labels={GERMAN_SIDEBAR_LABELS}>
				<SidebarProvider storage={STORAGE}>
					<SidebarTrigger />
				</SidebarProvider>
			</UiKitLabelsProvider>,
		);
		expect(screen.getByRole("button", { name: GERMAN_SIDEBAR_LABELS.sidebar.toggleSidebar })).toBeTruthy();
	});

	it("lays a partial labels prop over the family for this usage only", (): void => {
		mobileViewport = true;
		render(
			<SidebarProvider storage={STORAGE} labels={TOGGLE_OVERRIDE} openMobile>
				<Sidebar>
					<SidebarContent />
				</Sidebar>
				<SidebarTrigger />
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);
		// `hidden: true` — the open modal sheet marks the trigger behind it inert.
		expect(screen.getByRole("button", { name: TOGGLE_OVERRIDE.toggleSidebar, hidden: true })).toBeTruthy();
		// The strings the override leaves out still come from the family.
		expect(screen.getByText(UI_KIT_LABELS_EN.sidebar.mobileTitle)).toBeTruthy();
		expect(screen.getByText(UI_KIT_LABELS_EN.sidebar.mobileDescription)).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", (): void => {
		expect(() =>
			render(
				<SidebarProvider storage={STORAGE}>
					<SidebarTrigger />
				</SidebarProvider>,
			),
		).toThrow('"sidebar" labels');
	});
});
