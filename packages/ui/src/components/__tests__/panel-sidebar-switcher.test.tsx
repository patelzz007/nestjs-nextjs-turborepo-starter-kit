// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { PanelSidebarSwitcher, type PanelSidebarSwitcherGroup } from "../panel-sidebar-switcher";
import { SidebarProvider } from "../sidebar";

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

function group(overrides: Partial<PanelSidebarSwitcherGroup> = {}): PanelSidebarSwitcherGroup {
	return {
		id: "stores",
		label: "Stores",
		value: "acme",
		onValueChange: vi.fn<(value: string) => void>(),
		options: [
			{ value: "acme", label: "Acme Coffee", description: "Owner" },
			{ value: "brew", label: "Brew Bros", description: "Staff" },
		],
		...overrides,
	};
}

function openMenu(): HTMLElement {
	fireEvent.click(screen.getByRole("button", { name: /^Switch store/u }));
	return screen.getByRole("menu");
}

describe("PanelSidebarSwitcher", () => {
	it("names the current context and its sub-context on the trigger", () => {
		render(
			<PanelSidebarSwitcher title="Acme Coffee" subtitle="Downtown" visual={<span>A</span>} triggerLabel="Switch store" groups={[group()]} showCollapseToggle={false} />,
			{
				wrapper: UiKitTestProviders,
			},
		);
		const trigger = screen.getByRole("button", { name: "Switch store: Acme Coffee, Downtown" });
		expect(trigger.textContent).toContain("Acme Coffee");
		expect(trigger.textContent).toContain("Downtown");
	});

	it("lists each group under its label, with the current choice checked", () => {
		render(<PanelSidebarSwitcher title="Acme Coffee" visual={<span>A</span>} triggerLabel="Switch store" groups={[group()]} showCollapseToggle={false} />, {
			wrapper: UiKitTestProviders,
		});
		const menu = openMenu();
		expect(within(menu).getByText("Stores")).toBeTruthy();
		const [acme, brew] = within(menu).getAllByRole("menuitemradio");
		expect(acme?.getAttribute("aria-checked")).toBe("true");
		expect(acme?.textContent).toContain("Owner");
		expect(brew?.getAttribute("aria-checked")).toBe("false");
	});

	it("reports a new choice to its group, and runs an action", () => {
		const onValueChange = vi.fn<(value: string) => void>();
		const onSelect = vi.fn<() => void>();
		render(
			<PanelSidebarSwitcher
				title="Acme Coffee"
				visual={<span>A</span>}
				triggerLabel="Switch store"
				groups={[group({ onValueChange })]}
				actions={[{ id: "new", label: "Add a store", onSelect }]}
				showCollapseToggle={false}
			/>,
			{ wrapper: UiKitTestProviders },
		);
		fireEvent.click(within(openMenu()).getByRole("menuitemradio", { name: /Brew Bros/u }));
		expect(onValueChange).toHaveBeenCalledWith("brew");
		// Choosing closes the menu.
		expect(screen.queryByRole("menu")).toBeNull();
		fireEvent.click(within(openMenu()).getByRole("menuitem", { name: "Add a store" }));
		expect(onSelect).toHaveBeenCalledTimes(1);
	});

	it("highlights rows with a soft wash, never the solid pill, and tints only the current choice", () => {
		render(<PanelSidebarSwitcher title="Acme Coffee" visual={<span>A</span>} triggerLabel="Switch store" groups={[group()]} showCollapseToggle={false} />, {
			wrapper: UiKitTestProviders,
		});
		const [acme, brew] = within(openMenu()).getAllByRole("menuitemradio");
		for (const row of [acme, brew]) {
			expect(row?.getAttribute("data-highlight")).toBe("soft");
			expect(row?.className).toContain("data-checked:bg-primary/10");
		}
		expect(acme?.hasAttribute("data-checked")).toBe(true);
		expect(brew?.hasAttribute("data-checked")).toBe(false);
	});

	it("labels each group in sentence case with how many choices it holds", () => {
		render(<PanelSidebarSwitcher title="Acme Coffee" visual={<span>A</span>} triggerLabel="Switch store" groups={[group()]} showCollapseToggle={false} />, {
			wrapper: UiKitTestProviders,
		});
		const menu = openMenu();
		expect(within(menu).getByText("Stores").closest("[data-slot]")?.className).not.toContain("uppercase");
		expect(menu.querySelector('[data-slot="panel-sidebar-switcher-count"]')?.textContent).toBe("2");
	});

	it("sets each action's icon in a dashed add tile and keeps the action readable when highlighted", () => {
		render(
			<PanelSidebarSwitcher
				title="Acme Coffee"
				visual={<span>A</span>}
				triggerLabel="Switch store"
				groups={[group()]}
				actions={[{ id: "manage", label: "Manage stores", icon: <svg data-testid="manage-icon" />, onSelect: vi.fn<() => void>() }]}
				showCollapseToggle={false}
			/>,
			{ wrapper: UiKitTestProviders },
		);
		const action = within(openMenu()).getByRole("menuitem", { name: "Manage stores" });
		expect(action.getAttribute("data-highlight")).toBe("soft");
		expect(action.className).toContain("data-highlighted:text-foreground");
		const tile = action.querySelector('[data-slot="panel-sidebar-switcher-action-icon"]');
		expect(tile?.className).toContain("border-dashed");
		expect(tile?.contains(screen.getByTestId("manage-icon"))).toBe(true);
	});

	it("leaves out a group with no options", () => {
		render(
			<PanelSidebarSwitcher
				title="Acme Coffee"
				visual={<span>A</span>}
				triggerLabel="Switch store"
				groups={[group(), group({ id: "locations", label: "Locations", options: [] })]}
				showCollapseToggle={false}
			/>,
			{ wrapper: UiKitTestProviders },
		);
		expect(within(openMenu()).queryByText("Locations")).toBeNull();
	});

	it("keeps the sidebar's collapse toggle, and forwards its ref", () => {
		// jsdom has no matchMedia; the sidebar provider reads the mobile breakpoint through it.
		vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
			matches: false,
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}));
		const ref = React.createRef<HTMLDivElement>();
		render(
			<SidebarProvider>
				<PanelSidebarSwitcher ref={ref} title="Acme Coffee" visual={<span>A</span>} triggerLabel="Switch store" groups={[group()]} />
			</SidebarProvider>,
			{ wrapper: UiKitTestProviders },
		);
		expect(ref.current?.dataset.slot).toBe("panel-sidebar-switcher");
		expect(ref.current?.querySelector('[data-sidebar="trigger"]')).not.toBeNull();
	});
});
