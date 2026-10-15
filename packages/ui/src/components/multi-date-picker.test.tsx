// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { chooseCalendarDropdownOption, stubResizeObserverForCalendarDropdowns } from "@workspace/ui/testing/calendar-dropdowns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MultiDatePicker } from "./multi-date-picker";

beforeEach((): void => {
	stubResizeObserverForCalendarDropdowns();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

/** Module-scope formatter so the prop identity is stable across renders. */
function formatIso(date: Date): string {
	return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The day button react-day-picker renders for a local calendar date. */
function dayButton(year: number, monthIndex: number, day: number): HTMLButtonElement {
	const button = document.querySelector<HTMLButtonElement>(`button[data-day="${new Date(year, monthIndex, day).toLocaleDateString()}"]`);
	if (button === null) {
		throw new Error(`No day button for ${String(year)}-${String(monthIndex + 1)}-${String(day)}`);
	}
	return button;
}

describe("MultiDatePicker", () => {
	it("forwards its ref to the trigger button", (): void => {
		const ref = React.createRef<HTMLButtonElement>();
		render(<MultiDatePicker ref={ref} id="days" placeholder="Pick days" />, { wrapper: UiKitTestProviders });
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
		expect(ref.current?.id).toBe("days");
	});

	it("shows the caller's placeholder while empty, and every picked day once set", (): void => {
		render(<MultiDatePicker placeholder="Pick days" />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button", { name: "Pick days" })).toBeTruthy();
		cleanup();

		render(<MultiDatePicker value={["2026-10-03", "2026-09-04"]} formatDate={formatIso} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("button").textContent).toContain("2026-10-03, 2026-09-04");
	});

	it("picks and unpicks days, reporting them in date order, and stays open", (): void => {
		const onValueChange = vi.fn();
		render(<MultiDatePicker defaultOpen defaultValue={["2026-10-03"]} onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });

		fireEvent.click(dayButton(2026, 9, 14));
		expect(onValueChange).toHaveBeenLastCalledWith(["2026-10-03", "2026-10-14"]);
		fireEvent.click(dayButton(2026, 9, 1));
		expect(onValueChange).toHaveBeenLastCalledWith(["2026-10-01", "2026-10-03", "2026-10-14"]);
		fireEvent.click(dayButton(2026, 9, 3));
		expect(onValueChange).toHaveBeenLastCalledWith(["2026-10-01", "2026-10-14"]);
		expect(document.querySelector('[data-slot="calendar"]')).not.toBeNull();
	});

	it("picks days in other months through the month dropdown", (): void => {
		const onValueChange = vi.fn();
		render(<MultiDatePicker defaultOpen defaultValue={["2026-10-03"]} onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });

		chooseCalendarDropdownOption("Choose the Month", "Sep");
		fireEvent.click(dayButton(2026, 8, 4));
		expect(onValueChange).toHaveBeenLastCalledWith(["2026-09-04", "2026-10-03"]);
	});

	it("stops adding days at maxDates, but still unpicks one", (): void => {
		const onValueChange = vi.fn();
		render(<MultiDatePicker defaultOpen defaultValue={["2026-10-03", "2026-10-05"]} maxDates={2} onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });

		expect(dayButton(2026, 9, 7).disabled).toBe(true);
		fireEvent.click(dayButton(2026, 9, 7));
		expect(onValueChange).not.toHaveBeenCalled();
		fireEvent.click(dayButton(2026, 9, 5));
		expect(onValueChange).toHaveBeenLastCalledWith(["2026-10-03"]);
	});

	it("disables days outside fromDate…toDate", (): void => {
		render(<MultiDatePicker open defaultValue={["2026-10-10"]} fromDate="2026-10-05" toDate="2026-10-20" />, { wrapper: UiKitTestProviders });
		expect(dayButton(2026, 9, 4).disabled).toBe(true);
		expect(dayButton(2026, 9, 21).disabled).toBe(true);
		expect(dayButton(2026, 9, 12).disabled).toBe(false);
	});

	it("submits one hidden input per picked day", (): void => {
		const { container } = render(<MultiDatePicker name="days" defaultValue={["2026-09-04", "2026-10-03"]} />, { wrapper: UiKitTestProviders });
		const values = [...container.querySelectorAll<HTMLInputElement>('input[name="days"]')].map((input: HTMLInputElement): string => input.value);
		expect(values).toStrictEqual(["2026-09-04", "2026-10-03"]);
	});

	it("reports open changes and stays closed while the parent keeps open={false}", (): void => {
		const onOpenChange = vi.fn();
		render(<MultiDatePicker open={false} onOpenChange={onOpenChange} placeholder="Pick days" />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("button", { name: "Pick days" }));
		expect(onOpenChange).toHaveBeenCalledWith(true);
		expect(document.querySelector('[data-slot="calendar"]')).toBeNull();
	});
});
