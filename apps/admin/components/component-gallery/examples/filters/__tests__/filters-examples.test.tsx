// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { describe, expect, it } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { FILTERS_EXAMPLES } from "@/components/component-gallery/examples/filters";
import { Filters11Example } from "@/components/component-gallery/examples/filters/filters-11";
import { Filters3Example } from "@/components/component-gallery/examples/filters/filters-3";

describeGalleryExamples("Filters", FILTERS_EXAMPLES);

describe("Filters gallery example interactions", (): void => {
	installGalleryExampleShims();

	it("adds a filter from the chip row's field picker", (): void => {
		render(<Filters3Example />, { wrapper: UiKitTestProviders });
		const toolbar = screen.getByRole("toolbar", { name: "Filters" });
		const before = within(toolbar).getAllByRole("group").length;

		fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
		fireEvent.click(screen.getByRole("option", { name: "Title" }));

		expect(within(toolbar).getAllByRole("group").length).toBe(before + 1);
	});

	it("adding a condition in the inline builder updates the shown query", (): void => {
		render(<Filters11Example />, { wrapper: UiKitTestProviders });
		// The seed holds four rules: one, a group of two, and one more.
		expect(screen.getByText("4 rules")).toBeTruthy();
		expect(screen.getByText(/repository_stars >= 100/)).toBeTruthy();

		// The footer's Add filter, last in document order, appends to the root group.
		const rootAdd = screen.getAllByRole("button", { name: "Add filter" }).at(-1);
		if (rootAdd === undefined) throw new Error("the builder renders no Add filter button");
		fireEvent.click(rootAdd);

		expect(screen.getByText("5 rules")).toBeTruthy();
	});
});
