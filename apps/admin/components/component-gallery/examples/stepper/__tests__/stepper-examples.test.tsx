// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { STEPPER_EXAMPLES } from "@/components/component-gallery/examples/stepper";
import { Stepper1Example } from "@/components/component-gallery/examples/stepper/stepper-1";
import { Stepper4Example } from "@/components/component-gallery/examples/stepper/stepper-4";

describeGalleryExamples("Stepper", STEPPER_EXAMPLES);

/** The stepper's tabs, in step order. */
function stepTabs(): HTMLElement[] {
	return screen.getAllByRole("tab");
}

function tabAt(slot: number): HTMLElement {
	const tab = stepTabs().at(slot);
	if (tab === undefined) {
		throw new Error(`Expected a step tab at position ${String(slot)}`);
	}
	return tab;
}

describe("Stepper example interactions", (): void => {
	installGalleryExampleShims();

	it("opens on step 2 and moves to the step whose trigger is clicked", (): void => {
		render(<Stepper1Example />, { wrapper: UiKitTestProviders });

		expect(tabAt(LIST_SLOT_INDEX.second).getAttribute("aria-selected")).toBe("true");
		expect(screen.getByRole("tabpanel").textContent).toBe("Step 2 content");
		expect(tabAt(LIST_SLOT_INDEX.first).getAttribute("data-state")).toBe("completed");

		fireEvent.click(tabAt(LIST_SLOT_INDEX.fourth));

		expect(tabAt(LIST_SLOT_INDEX.fourth).getAttribute("aria-selected")).toBe("true");
		expect(tabAt(LIST_SLOT_INDEX.second).getAttribute("aria-selected")).toBe("false");
		expect(screen.getByRole("tabpanel").textContent).toBe("Step 4 content");
	});

	it("walks the steps with Previous and Next, disabling each at its end", (): void => {
		render(<Stepper4Example />, { wrapper: UiKitTestProviders });
		const previous = screen.getByRole("button", { name: "Previous" });
		const next = screen.getByRole("button", { name: "Next" });

		fireEvent.click(previous);
		expect(screen.getByRole("tabpanel").textContent).toBe("Step 1 content");
		expect(previous).toHaveProperty("disabled", true);

		fireEvent.click(next);
		fireEvent.click(next);
		fireEvent.click(next);
		expect(screen.getByRole("tabpanel").textContent).toBe("Step 4 content");
		expect(next).toHaveProperty("disabled", true);
		expect(tabAt(LIST_SLOT_INDEX.fourth).getAttribute("aria-selected")).toBe("true");
	});
});
