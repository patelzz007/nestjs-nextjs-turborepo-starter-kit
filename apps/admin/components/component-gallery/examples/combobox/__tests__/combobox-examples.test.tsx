// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { COMBOBOX_EXAMPLES } from "@/components/component-gallery/examples/combobox";
import { Combobox1Example } from "@/components/component-gallery/examples/combobox/combobox-1";
import { Combobox12Example } from "@/components/component-gallery/examples/combobox/combobox-12";

describeGalleryExamples("Combobox", COMBOBOX_EXAMPLES);

function optionTexts(): string[] {
	return screen.queryAllByRole("option").map((option: HTMLElement): string => option.textContent);
}

describe("Combobox example interactions", (): void => {
	installGalleryExampleShims();

	it("filters the framework list as you type and fills the input with the picked option", (): void => {
		render(<Combobox1Example />, { wrapper: UiKitTestProviders });
		const input = screen.getByPlaceholderText("Select a framework");

		act((): void => {
			fireEvent.keyDown(input, { key: "ArrowDown" });
		});
		expect(optionTexts()).toEqual(["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"]);

		act((): void => {
			fireEvent.change(input, { target: { value: "rem" } });
		});
		expect(optionTexts()).toEqual(["Remix"]);

		act((): void => {
			fireEvent.click(screen.getByRole("option", { name: "Remix" }));
		});
		expect(input).toHaveProperty("value", "Remix");
	});

	it("removes a chip from the controlled multi-select", (): void => {
		const { container } = render(<Combobox12Example />, { wrapper: UiKitTestProviders });
		const chips = (): HTMLElement[] => Array.from(container.querySelectorAll<HTMLElement>('[data-slot="combobox-chip"]'));
		expect(chips().map((chip: HTMLElement): string => chip.textContent)).toEqual(["Next.js"]);

		const [chip] = chips();
		if (chip === undefined) {
			throw new Error("Expected the initial Next.js chip");
		}
		act((): void => {
			fireEvent.click(within(chip).getByRole("button"));
		});
		expect(chips()).toHaveLength(0);
	});
});
