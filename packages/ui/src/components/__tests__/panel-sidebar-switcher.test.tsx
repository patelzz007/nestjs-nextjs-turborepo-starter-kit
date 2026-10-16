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
