// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import {
	calendarDropdownOptionTexts,
	chooseCalendarDropdownOption,
	openCalendarDropdown,
	stubResizeObserverForCalendarDropdowns,
} from "@workspace/ui/testing/calendar-dropdowns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Calendar } from "./calendar";

beforeEach((): void => {
	stubResizeObserverForCalendarDropdowns();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("Calendar", () => {
	it("forwards its ref to the calendar root", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<Calendar ref={ref} mode="single" defaultMonth={new Date(2026, 3, 1)} />, { wrapper: UiKitTestProviders });
		expect(ref.current?.dataset.slot).toBe("calendar");
	});

	it("sizes the weekday header through the calendar caption token", (): void => {
		const { container } = render(<Calendar mode="single" defaultMonth={new Date(2026, 3, 1)} />, { wrapper: UiKitTestProviders });
		const weekday = container.querySelector(".rdp-weekday");
		expect(weekday?.className).toContain("text-[length:var(--text-calendar-caption)]");
	});

	it("moves DOM focus to the day react-day-picker marks as focused during keyboard navigation", (): void => {
		const { container } = render(<Calendar mode="single" defaultMonth={new Date(2026, 3, 1)} />, { wrapper: UiKitTestProviders });
		const firstDay = container.querySelector<HTMLButtonElement>("button[data-day]");
		expect(firstDay).not.toBeNull();
		act((): void => {
			firstDay?.focus();
		});
		fireEvent.keyDown(document.activeElement ?? container, { key: "ArrowRight" });
		const focused = document.activeElement;
		expect(focused).not.toBe(firstDay);
		expect(focused?.hasAttribute("data-day")).toBe(true);
	});

	it("offers the month and year as UI kit dropdowns by default, so a far month is one pick away", (): void => {
		const { container } = render(<Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} />, { wrapper: UiKitTestProviders });
		expect(container.querySelector("select")).toBeNull();
		expect(calendarDropdownOptionTexts("Choose the Month")).toHaveLength(12);

		chooseCalendarDropdownOption("Choose the Month", "Jan");
		chooseCalendarDropdownOption("Choose the Year", "1990");

		expect(container.querySelector(`button[data-day="${new Date(1990, 0, 15).toLocaleDateString()}"]`)).not.toBeNull();
	});

	it("lets clicks through the nav bar that lies over the caption, so the dropdowns stay clickable", (): void => {
		const { container } = render(<Calendar mode="single" defaultMonth={new Date(2026, 9, 1)} />, { wrapper: UiKitTestProviders });
		expect(container.querySelector(".rdp-nav")?.className).toContain("pointer-events-none");
		expect(screen.getByRole("button", { name: /previous month/iu }).className).toContain("pointer-events-auto");
		expect(screen.getByRole("button", { name: /next month/iu }).className).toContain("pointer-events-auto");
	});

	it("reaches a hundred years back and ten ahead when the caller sets no bounds", (): void => {
		const today = new Date(2026, 9, 16);
		render(<Calendar mode="single" today={today} defaultMonth={today} />, { wrapper: UiKitTestProviders });
		const years = calendarDropdownOptionTexts("Choose the Year");
		expect(years.at(0)).toBe("1926");
		expect(years.at(-1)).toBe("2036");
	});

	it("keeps the caller's own bounds, and disables the months outside them", (): void => {
		render(<Calendar mode="single" defaultMonth={new Date(2024, 3, 1)} startMonth={new Date(2024, 2, 1)} endMonth={new Date(2026, 11, 1)} />, { wrapper: UiKitTestProviders });
		expect(calendarDropdownOptionTexts("Choose the Year")).toStrictEqual(["2024", "2025", "2026"]);
		cleanup();

		render(<Calendar mode="single" defaultMonth={new Date(2024, 3, 1)} startMonth={new Date(2024, 2, 1)} endMonth={new Date(2026, 11, 1)} />, { wrapper: UiKitTestProviders });
		openCalendarDropdown("Choose the Month");
		expect(screen.getByRole("option", { name: "Feb" }).getAttribute("aria-disabled")).toBe("true");
		expect(screen.getByRole("option", { name: "Mar" }).getAttribute("aria-disabled")).not.toBe("true");
	});

	it("lands a chosen year whose month is out of range on the nearest month in range", (): void => {
		const { container } = render(<Calendar mode="single" defaultMonth={new Date(2025, 0, 1)} startMonth={new Date(2024, 2, 1)} endMonth={new Date(2026, 11, 1)} />, {
			wrapper: UiKitTestProviders,
		});
		chooseCalendarDropdownOption("Choose the Year", "2024");
		expect(container.querySelector(`button[data-day="${new Date(2024, 2, 15).toLocaleDateString()}"]`)).not.toBeNull();
	});

	it("shows a plain caption, without dropdowns, when the caller asks for the label layout", (): void => {
		render(<Calendar mode="single" captionLayout="label" defaultMonth={new Date(2026, 3, 1)} />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("combobox")).toBeNull();
		expect(screen.getByText("April 2026")).toBeTruthy();
	});
});
