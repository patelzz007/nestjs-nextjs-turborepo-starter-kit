// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Rating } from "../rating";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";

afterEach((): void => {
	cleanup();
});

describe("Rating", () => {
	it("names a read-only rating by its value and renders the partial star", (): void => {
		const { container } = render(<Rating rating={3.5} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("img", { name: "Rated 3.5 out of 5" })).toBeTruthy();
		const fills = Array.from(container.querySelectorAll<SVGElement>('[data-slot="rating-star-filled"]'));
		expect(fills).toHaveLength(5);
		const partial = fills[LIST_SLOT_INDEX.fourth]?.parentElement;
		expect(partial?.style.width).toBe("50%");
		expect(screen.queryAllByRole("radio")).toHaveLength(0);
	});

	it("shows the numeric value with showValue and honours maxRating", (): void => {
		render(<Rating rating={4} maxRating={10} showValue starClassName="font-bold" />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("img", { name: "Rated 4.0 out of 10" })).toBeTruthy();
		const value = screen.getByText("4.0");
		expect(value.dataset.slot).toBe("rating-value");
		expect(value.className).toContain("font-bold");
	});

	it("is a radiogroup of star buttons when editable, reporting the clicked star", (): void => {
		const onRatingChange = vi.fn();
		render(<Rating rating={2} editable onRatingChange={onRatingChange} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("radiogroup", { name: "Rating" })).toBeTruthy();
		const second = screen.getByRole("radio", { name: "2 stars out of 5" });
		expect(second.getAttribute("aria-checked")).toBe("true");
		expect(second.tabIndex).toBe(0);
		expect(screen.getByRole("radio", { name: "1 star out of 5" }).tabIndex).toBe(-1);
		fireEvent.click(screen.getByRole("radio", { name: "4 stars out of 5" }));
		expect(onRatingChange).toHaveBeenCalledWith(4);
	});

	it("moves the rating with the arrow, Home and End keys", (): void => {
		const onRatingChange = vi.fn();
		render(<Rating rating={2} editable onRatingChange={onRatingChange} />, { wrapper: UiKitTestProviders });
		const second = screen.getByRole("radio", { name: "2 stars out of 5" });
		fireEvent.keyDown(second, { key: "ArrowRight" });
		fireEvent.keyDown(second, { key: "ArrowLeft" });
		fireEvent.keyDown(second, { key: "End" });
		fireEvent.keyDown(second, { key: "Home" });
		expect(onRatingChange.mock.calls).toEqual([[3], [1], [5], [1]]);
		expect(document.activeElement).toBe(screen.getByRole("radio", { name: "1 star out of 5" }));
	});

	it("previews the hovered star", (): void => {
		const { container } = render(<Rating rating={1} editable onRatingChange={vi.fn()} />, { wrapper: UiKitTestProviders });
		fireEvent.mouseEnter(screen.getByRole("radio", { name: "3 stars out of 5" }));
		const fills = Array.from(container.querySelectorAll<SVGElement>('[data-slot="rating-star-filled"]'));
		expect(fills[LIST_SLOT_INDEX.third]?.parentElement?.style.width).toBe("100%");
		fireEvent.mouseLeave(screen.getByRole("radio", { name: "3 stars out of 5" }));
		expect(fills[LIST_SLOT_INDEX.third]?.parentElement?.style.width).toBe("0%");
	});

	it("disables the stars and applies the disabled state", (): void => {
		const onRatingChange = vi.fn();
		render(<Rating rating={2} editable disabled onRatingChange={onRatingChange} />, { wrapper: UiKitTestProviders });
		const group = screen.getByRole("radiogroup");
		expect(group.getAttribute("aria-disabled")).toBe("true");
		expect(group.className).toContain("opacity-50");
		const star = screen.getByRole("radio", { name: "3 stars out of 5" });
		expect(star).toHaveProperty("disabled", true);
		fireEvent.click(star);
		expect(onRatingChange).not.toHaveBeenCalled();
	});

	it("applies the error state for aria-invalid", (): void => {
		render(<Rating rating={0} editable aria-invalid onRatingChange={vi.fn()} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("radiogroup").className).toContain("ring-destructive/30");
		expect(screen.getByRole("radio", { name: "1 star out of 5" }).tabIndex).toBe(0);
	});

	it("reads copy overrides from labels", (): void => {
		render(<Rating rating={3} labels={{ value: (rating: string): string => `Note ${rating}` }} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("img", { name: "Note 3.0" })).toBeTruthy();
	});

	it("forwards its ref and merges className", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<Rating ref={ref} rating={1} size="lg" className="mt-2" />, { wrapper: UiKitTestProviders });
		expect(ref.current?.dataset.slot).toBe("rating");
		expect(ref.current?.className).toContain("mt-2");
		expect(ref.current?.className).toContain("gap-3");
	});
});
