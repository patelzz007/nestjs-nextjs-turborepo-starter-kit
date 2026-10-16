// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { AUTOCOMPLETE_EXAMPLES } from "@/components/component-gallery/examples/autocomplete";
import { Autocomplete1Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-1";
import { Autocomplete12Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-12";
import { Autocomplete8Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-8";
import { Autocomplete9Example } from "@/components/component-gallery/examples/autocomplete/autocomplete-9";
import { containsQuery, initialsOf } from "@/components/component-gallery/examples/autocomplete/autocomplete-sample-data";

describeGalleryExamples("Autocomplete", AUTOCOMPLETE_EXAMPLES);

describe("Autocomplete sample helpers", (): void => {
	it("matches ignoring case and accents", (): void => {
		expect(containsQuery("José García", "jose")).toBe(true);
		expect(containsQuery("Alert Dialog", "DIAL")).toBe(true);
		expect(containsQuery("Toast", "dialog")).toBe(false);
	});

	it("builds avatar initials from each word", (): void => {
		expect(initialsOf("Jane Smith")).toBe("JS");
	});
});

/** Types into an autocomplete and opens its suggestions (ArrowDown), as a keyboard user would. */
function typeQuery(input: HTMLElement, query: string): void {
	fireEvent.change(input, { target: { value: query } });
	fireEvent.keyDown(input, { key: "ArrowDown" });
}

describe("Autocomplete gallery example interactions", (): void => {
	installGalleryExampleShims();

	it("suggests only the tags matching what was typed", async (): Promise<void> => {
		render(<Autocomplete1Example />, { wrapper: UiKitTestProviders });

		typeQuery(screen.getByPlaceholderText("Search items"), "dialog");

		expect(await screen.findByRole("option", { name: "component: Alert Dialog", hidden: true })).toBeTruthy();
		expect(screen.getByRole("option", { name: "component: Dialog", hidden: true })).toBeTruthy();
		expect(screen.queryByRole("option", { name: "Feature", hidden: true })).toBeNull();
	});

	it("keeps only the teams with a matching person", async (): Promise<void> => {
		render(<Autocomplete8Example />, { wrapper: UiKitTestProviders });

		typeQuery(screen.getByPlaceholderText("e.g. John, Developer, Marketing"), "Designer");

		expect(await screen.findByText("Design Team")).toBeTruthy();
		expect(screen.queryByText("Sales Team")).toBeNull();
	});

	it("reports the simulated search's results, then its failure", async (): Promise<void> => {
		render(<Autocomplete9Example />, { wrapper: UiKitTestProviders });
		const input = screen.getByPlaceholderText("e.g. John Smith, React, San Francisco");

		typeQuery(input, "Kubernetes");
		expect(await screen.findByText(/developers? found$/)).toBeTruthy();

		typeQuery(input, "error");
		expect(await screen.findByText("Failed to fetch developers. Please try again.")).toBeTruthy();
	});

	it("validates the feature with the shared schema on submit", async (): Promise<void> => {
		render(<Autocomplete12Example />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: "Submit" }));

		expect(await screen.findByText("Please select an item.")).toBeTruthy();
	});
});
