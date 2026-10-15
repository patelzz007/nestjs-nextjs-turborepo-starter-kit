// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { chooseCalendarDropdownOption, stubResizeObserverForCalendarDropdowns } from "@workspace/ui/testing/calendar-dropdowns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoDateBoundsOf, ProfileDemoDates } from "../profile-demo-dates";

beforeEach((): void => {
	stubResizeObserverForCalendarDropdowns();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

/** The day button react-day-picker renders for a local calendar date. */
function dayButton(year: number, monthIndex: number, day: number): HTMLButtonElement {
	const button = document.querySelector<HTMLButtonElement>(`button[data-day="${new Date(year, monthIndex, day).toLocaleDateString()}"]`);
	if (button === null) {
		throw new Error(`No day button for ${String(year)}-${String(monthIndex + 1)}-${String(day)}`);
	}
	return button;
}

describe("demoDateBoundsOf", () => {
	it("lets a birth date run from 1 January a hundred years back to today, and available days from today to the end of next year", () => {
		expect(demoDateBoundsOf(new Date(2026, 9, 16))).toStrictEqual({
			birth: { fromDate: "1926-01-01", toDate: "2026-10-16" },
			availability: { fromDate: "2026-10-16", toDate: "2027-12-31" },
		});
	});
});

describe("ProfileDemoDates", () => {
	it("says the dates are a demo and not saved", () => {
		render(<ProfileDemoDates />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("Demo only — these dates are not saved.")).toBeTruthy();
	});

	it("picks a date of birth decades back through the year and month dropdowns", () => {
		render(<ProfileDemoDates />, { wrapper: UiKitTestProviders });

		const trigger = screen.getByRole("button", { name: "Date of birth" });
		expect(trigger.textContent).toContain("Pick your date of birth");
		fireEvent.click(trigger);
		chooseCalendarDropdownOption("Choose the Year", "1990");
		chooseCalendarDropdownOption("Choose the Month", "Mar");
		fireEvent.click(dayButton(1990, 2, 15));

		expect(screen.getByRole("button", { name: "Date of birth" }).textContent).toContain("March 15th, 1990");
	});
});
