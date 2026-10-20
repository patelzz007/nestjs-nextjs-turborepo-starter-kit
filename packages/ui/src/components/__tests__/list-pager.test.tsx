// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { ListPager } from "../list-pager";

afterEach((): void => {
	cleanup();
});

describe("ListPager", () => {
	it("shows the position and moves through the parent's callbacks", () => {
		const onPrevious = vi.fn();
		const onNext = vi.fn();
		render(<ListPager page={2} totalPages={5} hasPrevious hasNext onPrevious={onPrevious} onNext={onNext} />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("navigation", { name: "Pages" })).toBeTruthy();
		expect(screen.getByText("Page 2 of 5")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(onPrevious).toHaveBeenCalledTimes(1);
		expect(onNext).toHaveBeenCalledTimes(1);
	});

	it("disables a direction with no page, and both while a page loads", () => {
		const { rerender } = render(<ListPager page={1} totalPages={null} hasPrevious={false} hasNext onPrevious={vi.fn()} onNext={vi.fn()} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Page 1")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(false);

		rerender(<ListPager page={1} totalPages={3} hasPrevious={false} hasNext disabled onPrevious={vi.fn()} onNext={vi.fn()} />);
		expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
	});

	it("takes a per-usage name for its landmark and forwards its ref", () => {
		const ref = React.createRef<HTMLElement>();
		render(<ListPager ref={ref} page={1} totalPages={1} hasPrevious={false} hasNext={false} onPrevious={vi.fn()} onNext={vi.fn()} labels={{ ariaLabel: "Device pages" }} />, {
			wrapper: UiKitTestProviders,
		});

		expect(screen.getByRole("navigation", { name: "Device pages" })).toBe(ref.current);
	});
});
