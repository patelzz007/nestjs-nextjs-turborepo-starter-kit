// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { calendarDropdownOptionTexts, stubResizeObserverForCalendarDropdowns } from "@workspace/ui/testing/calendar-dropdowns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatePicker } from "../date-picker";

beforeEach((): void => {
	stubResizeObserverForCalendarDropdowns();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

/** Module-scope formatter so the prop identity is stable across renders. */
function formatIso(date: Date): string {
	return date.toISOString().slice(0, "yyyy-MM-dd".length);
}

describe("DatePicker", () => {
	it("forwards its ref to the trigger button", (): void => {
		const ref = React.createRef<HTMLButtonElement>();
		render(<DatePicker ref={ref} id="start" placeholder="Select a date" />, { wrapper: UiKitTestProviders });
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
		expect(ref.current?.id).toBe("start");
	});

	it("shows the caller's placeholder while empty — it has no copy of its own", (): void => {
		render(<DatePicker placeholder="Select start date" />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("Select start date")).toBeTruthy();
	});

	it("renders an uncontrolled defaultValue through formatDate and mirrors it in the hidden input", (): void => {
		const { container } = render(<DatePicker name="start" defaultValue="2026-04-29" formatDate={formatIso} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button").textContent).toContain(formatIso(new Date(2026, 3, 29)));
		expect(container.querySelector<HTMLInputElement>('input[name="start"]')?.value).toBe("2026-04-29");
	});

	it("reports open changes and stays closed while the parent keeps open={false}", (): void => {
		const onOpenChange = vi.fn();
		render(<DatePicker open={false} onOpenChange={onOpenChange} placeholder="Pick" />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("button", { name: "Pick" }));
		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(document.querySelector('[data-slot="calendar"]')).toBeNull();
	});

	it("renders the calendar when the parent sets open", (): void => {
		render(<DatePicker open placeholder="Pick" />, { wrapper: UiKitTestProviders });
		expect(document.querySelector('[data-slot="calendar"]')).not.toBeNull();
	});

	it("passes onBlur and onFocus through to the trigger", (): void => {
		const onBlur = vi.fn();
		const onFocus = vi.fn();
		render(<DatePicker placeholder="Pick" onBlur={onBlur} onFocus={onFocus} />, { wrapper: UiKitTestProviders });
		const trigger = screen.getByRole("button", { name: "Pick" });
		fireEvent.focus(trigger);
		fireEvent.blur(trigger);
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it("limits the calendar's year dropdown to fromDate…toDate", (): void => {
		render(<DatePicker open placeholder="Pick" fromDate="1990-06-15" toDate="1993-02-01" />, { wrapper: UiKitTestProviders });
		const years = calendarDropdownOptionTexts("Choose the Year");
		expect(years).toStrictEqual(["1990", "1991", "1992", "1993"]);
	});
});
