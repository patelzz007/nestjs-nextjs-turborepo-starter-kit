// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { SIDEBAR_EXAMPLES } from "@/components/component-gallery/examples/sidebar";
import { Sidebar2Example } from "@/components/component-gallery/examples/sidebar/sidebar-2";
import { Sidebar3Example } from "@/components/component-gallery/examples/sidebar/sidebar-3";

describeGalleryExamples("Sidebar", SIDEBAR_EXAMPLES);

/** The desktop panel's root, which carries the open state as `data-state`. */
function sidebarPanel(): Element | null {
	return document.querySelector('[data-slot="sidebar"][data-state]');
}

describe("Sidebar gallery example interactions", (): void => {
	installGalleryExampleShims();

	it("collapses the icon rail from the trigger without touching the app shell's sidebar cookie", (): void => {
		const cookieBefore = document.cookie;
		render(<Sidebar2Example />, { wrapper: UiKitTestProviders });
		expect(sidebarPanel()?.getAttribute("data-state")).toBe("expanded");

		// The header trigger, not the rail strip on the panel edge (which shares its label).
		const trigger = screen.getAllByRole("button", { name: "Toggle sidebar" }).find((button) => button.dataset.slot === "sidebar-trigger");
		expect(trigger).toBeDefined();
		if (trigger !== undefined) {
			fireEvent.click(trigger);
		}

		expect(sidebarPanel()?.getAttribute("data-state")).toBe("collapsed");
		expect(document.cookie).toBe(cookieBefore);
	});

	it("filters the docs navigation down to the pages that match the query", (): void => {
		render(<Sidebar3Example />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("Anatomy")).toBeTruthy();

		fireEvent.change(screen.getByLabelText("Search the documentation"), { target: { value: "row" } });

		expect(screen.getByText("Row selection")).toBeTruthy();
		expect(screen.queryByText("Anatomy")).toBeNull();
	});
});
