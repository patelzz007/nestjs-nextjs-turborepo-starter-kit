// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { CASCADER_EXAMPLES } from "@/components/component-gallery/examples/cascader";
import { Cascader9Example } from "@/components/component-gallery/examples/cascader/cascader-9";

describeGalleryExamples("Cascader", CASCADER_EXAMPLES);

/** Presses a row the way base-ui commits: a pointer press, then the click. */
function pressRow(name: RegExp): void {
	const row = screen.getByRole("option", { name });
	act((): void => {
		fireEvent.pointerDown(row, { pointerType: "mouse" });
		fireEvent.click(row);
	});
}

describe("Cascader gallery example interactions", (): void => {
	installGalleryExampleShims();

	it("drills down to a leaf and reports the committed path", async (): Promise<void> => {
		render(<Cascader9Example />, { wrapper: UiKitTestProviders });

		act((): void => {
			fireEvent.click(screen.getByRole("combobox", { name: "Menu item" }));
		});

		pressRow(/^Food/);
		expect(await screen.findByRole("option", { name: /^Mains/ })).toBeTruthy();
		pressRow(/^Mains/);
		expect(await screen.findByRole("option", { name: /^Curry/ })).toBeTruthy();
		pressRow(/^Curry/);

		expect(await screen.findByText("select: Food / Mains / Curry")).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "Menu item" }).textContent).toContain("Curry");
	});
});
