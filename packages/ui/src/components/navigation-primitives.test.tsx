// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels } from "../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { Accordion, AccordionItem, AccordionTrigger } from "./accordion";
import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbList } from "./breadcrumb";
import { PanelSidebarSectionHeader } from "./panel-sidebar-section-header";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./resizable";
import { Tabs, TabsList } from "./tabs";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";

/** react-resizable-panels measures its group — jsdom has no ResizeObserver. */
class NoopResizeObserver {
	public observe(): void {
		return undefined;
	}
	public unobserve(): void {
		return undefined;
	}
	public disconnect(): void {
		return undefined;
	}
}

afterEach((): void => {
	cleanup();
});

/** A label set whose `breadcrumb` family differs from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = { ...UI_KIT_LABELS_EN, breadcrumb: { ariaLabel: "Brotkrumen", ellipsis: "Mehr anzeigen" } };

describe("Breadcrumb", () => {
	it("forwards refs on the root and items, and names the landmark from the breadcrumb family", (): void => {
		const rootRef = React.createRef<HTMLElement>();
		const itemRef = React.createRef<HTMLLIElement>();
		render(
			<Breadcrumb ref={rootRef}>
				<BreadcrumbList>
					<BreadcrumbItem ref={itemRef}>Home</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>,
			{ wrapper: UiKitTestProviders },
		);

		expect(rootRef.current?.getAttribute("aria-label")).toBe(UI_KIT_LABELS_EN.breadcrumb.ariaLabel);
		expect(itemRef.current?.dataset.slot).toBe("breadcrumb-item");
	});

	it("lets a standard aria-label win over ariaLabel", (): void => {
		render(<Breadcrumb ariaLabel="Trail" aria-label="Fil d'Ariane" />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("navigation", { name: "Fil d'Ariane" })).toBeTruthy();
	});

	it("lets ariaLabel and the ellipsis label override the family per usage", (): void => {
		const { container } = render(
			<Breadcrumb ariaLabel="Trail">
				<BreadcrumbEllipsis label="Plus" />
				<BreadcrumbEllipsis />
			</Breadcrumb>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("navigation", { name: "Trail" })).toBeTruthy();
		const ellipsisTexts = [...container.querySelectorAll("[data-slot='breadcrumb-ellipsis'] .sr-only")].map((element) => element.textContent);
		expect(ellipsisTexts).toEqual(["Plus", UI_KIT_LABELS_EN.breadcrumb.ellipsis]);
	});

	it("reads the breadcrumb family from the nearest UiKitLabelsProvider", (): void => {
		const { container } = render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<Breadcrumb>
					<BreadcrumbEllipsis />
				</Breadcrumb>
			</UiKitLabelsProvider>,
		);
		expect(screen.getByRole("navigation", { name: GERMAN_LABELS.breadcrumb.ariaLabel })).toBeTruthy();
		expect(container.querySelector("[data-slot='breadcrumb-ellipsis'] .sr-only")?.textContent).toBe(GERMAN_LABELS.breadcrumb.ellipsis);
	});

	it("throws without a UiKitLabelsProvider", (): void => {
		expect(() => render(<Breadcrumb />)).toThrow('"breadcrumb" labels');
		expect(() => render(<BreadcrumbEllipsis />)).toThrow('"breadcrumb" labels');
	});
});

describe("PanelSidebarSectionHeader", () => {
	it("paints the section dot with a tone token, not a raw palette colour, and forwards its ref", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<PanelSidebarSectionHeader
				ref={ref}
				title="Catalog"
				index={0}
				isLast
				isSearching={false}
				isActiveSection={false}
				allTitles={["Catalog"]}
				color="green"
				moveUpTitle="Up"
				moveDownTitle="Down"
				moveUpAriaLabel="Move Catalog up"
				moveDownAriaLabel="Move Catalog down"
				onMoveSectionUp={vi.fn()}
				onMoveSectionDown={vi.fn()}
			/>,
		);

		expect(ref.current?.querySelector(".bg-tone-green")).not.toBeNull();
		expect(ref.current?.querySelector("[class*='emerald']")).toBeNull();
	});
});

describe("Resizable", () => {
	beforeAll((): void => {
		vi.stubGlobal("ResizeObserver", NoopResizeObserver);
	});

	afterAll((): void => {
		vi.unstubAllGlobals();
	});

	it("forwards refs on the group, panels and handle", (): void => {
		const groupRef = React.createRef<HTMLDivElement>();
		const panelRef = React.createRef<HTMLDivElement>();
		const handleRef = React.createRef<HTMLDivElement>();
		render(
			<ResizablePanelGroup ref={groupRef}>
				<ResizablePanel ref={panelRef}>One</ResizablePanel>
				<ResizableHandle ref={handleRef} withHandle />
				<ResizablePanel>Two</ResizablePanel>
			</ResizablePanelGroup>,
		);

		expect(groupRef.current?.dataset.slot).toBe("resizable-panel-group");
		expect(panelRef.current?.dataset.slot).toBe("resizable-panel");
		expect(handleRef.current?.dataset.slot).toBe("resizable-handle");
	});
});

describe("Tabs", () => {
	it("pads the list on the spacing scale (no arbitrary px value)", (): void => {
		render(
			<Tabs>
				<TabsList>Tabs</TabsList>
			</Tabs>,
		);
		const list = screen.getByRole("tablist");
		expect(list.className).toContain("p-0.75");
		expect(list.className).not.toContain("[3px]");
	});
});

describe("Accordion", () => {
	it("pins a sticky trigger with the named sticky layer", (): void => {
		render(
			<Accordion>
				<AccordionItem value="a">
					<AccordionTrigger sticky>Section</AccordionTrigger>
				</AccordionItem>
			</Accordion>,
		);
		const header = screen.getByRole("button", { name: "Section" }).parentElement;
		expect(header?.className).toContain("z-sticky");
		expect(header?.className).not.toContain("z-10");
	});
});
