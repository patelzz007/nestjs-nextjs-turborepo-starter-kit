import type { LocalDate } from "@workspace/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Calendar, initialCalendarMonth } from "../calendar";

const BOUNDS = { today: "2026-11-15", minDate: "2026-01-01", maxDate: "2027-12-31", locale: "en-GB" };

function isSunday(day: LocalDate): boolean {
	return day === "2026-11-22";
}

describe("Calendar", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("opens on the picked day's month and reports a tapped day", async () => {
		const onChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(<Calendar ref={ref} {...BOUNDS} value="2026-03-04" onChange={onChange} variant="card" testID="calendar" />);
		expect(screen.getByRole("button", { name: "Month: March" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("day-2026-03-10"));
		expect(onChange).toHaveBeenCalledWith("2026-03-10");
		expect(screen.getByTestId("calendar")).toHaveProp("className", expect.stringContaining("rounded-card"));
		expect(ref.current).not.toBeNull();
	});

	it("toggles days in multiple mode, ruling out the rest once full", async () => {
		const onChange = jest.fn();
		await render(<Calendar {...BOUNDS} mode="multiple" value={["2026-11-03", "2026-11-04"]} onChange={onChange} maxDays={2} />);
		expect(screen.getByTestId("day-2026-11-20")).toBeDisabled();
		await fireEvent.press(screen.getByTestId("day-2026-11-03"));
		expect(onChange).toHaveBeenCalledWith(["2026-11-04"]);
	});

	it("ends a range, and starts again when the range would cross a ruled out day", async () => {
		const onChange = jest.fn();
		await render(<Calendar {...BOUNDS} mode="range" value={{ from: "2026-11-16", to: null }} onChange={onChange} isUnavailable={isSunday} />);
		await fireEvent.press(screen.getByTestId("day-2026-11-20"));
		expect(onChange).toHaveBeenLastCalledWith({ from: "2026-11-16", to: "2026-11-20" });
		await fireEvent.press(screen.getByTestId("day-2026-11-25"));
		expect(onChange).toHaveBeenLastCalledWith({ from: "2026-11-25", to: null });
	});

	it("shows two months, and lets the caller own the shown month", async () => {
		const onMonthChange = jest.fn();
		await render(<Calendar {...BOUNDS} value={null} onChange={jest.fn()} numberOfMonths={2} month={{ year: 2026, month: 11 }} onMonthChange={onMonthChange} />);
		expect(screen.getByRole("header", { name: "December 2026" })).toBeOnTheScreen();
		expect(screen.getByTestId("day-2026-12-24")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Next month" }));
		expect(onMonthChange).toHaveBeenCalledWith({ year: 2026, month: 12 });
	});

	it("opens on today's month when nothing is picked, kept within the bounds", () => {
		expect(initialCalendarMonth({ ...BOUNDS, value: null, onChange: jest.fn() })).toStrictEqual({ year: 2026, month: 11 });
		expect(initialCalendarMonth({ ...BOUNDS, mode: "range", value: { from: "2025-02-01", to: null }, onChange: jest.fn() })).toStrictEqual({ year: 2026, month: 1 });
	});
});

describe("Calendar weekStartsOn", () => {
	it("starts each week on Sunday when asked", async () => {
		await render(<Calendar {...BOUNDS} value={null} onChange={jest.fn()} weekStartsOn={0} month={{ year: 2026, month: 11 }} />);
		// 1 November 2026 is a Sunday: the first slot of the first week.
		expect(screen.getByTestId("day-2026-11-01").parent?.children.at(0)).toBe(screen.getByTestId("day-2026-11-01"));
	});
});
