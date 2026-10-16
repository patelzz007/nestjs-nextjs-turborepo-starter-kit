import type { LocalDate } from "@workspace/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import type { CalendarMonth, RangeDayRole } from "../../lib/calendar";
import { CalendarMonthGrid } from "../calendar-month-grid";

const OCTOBER_2026: CalendarMonth = { year: 2026, month: 10 };

function rangeRoleOf(day: LocalDate): RangeDayRole {
	if (day === "2026-10-05") {
		return "start";
	}
	if (day === "2026-10-07") {
		return "end";
	}
	return day === "2026-10-06" ? "inside" : "none";
}

async function renderGrid(props: Partial<React.ComponentProps<typeof CalendarMonthGrid>> = {}): Promise<{ readonly onPick: jest.Mock }> {
	const onPick = jest.fn();
	await render(
		<CalendarMonthGrid
			month={OCTOBER_2026}
			today="2026-10-16"
			minDate="2026-10-02"
			maxDate="2026-10-20"
			locale="en-MY"
			roleOf={rangeRoleOf}
			onPick={onPick}
			testID="grid"
			{...props}
		/>,
	);
	return { onPick };
}

describe("CalendarMonthGrid", () => {
	it("names each day by its full date, its place in the selection and whether it is today", async () => {
		await renderGrid();

		expect(screen.getByTestId("day-2026-10-05")).toHaveAccessibleName("Monday, 5 October 2026, start");
		expect(screen.getByTestId("day-2026-10-06")).toHaveAccessibleName("Tuesday, 6 October 2026, in range");
		expect(screen.getByTestId("day-2026-10-07")).toHaveAccessibleName("Wednesday, 7 October 2026, end");
		expect(screen.getByTestId("day-2026-10-16")).toHaveAccessibleName("Friday, 16 October 2026, today");
		expect(screen.getByTestId("day-2026-10-06")).toBeSelected();
		expect(screen.getByTestId("day-2026-10-16")).not.toBeSelected();
	});

	it("lays the month out Monday first, with every day of the month", async () => {
		await renderGrid();
		expect(screen.getByTestId("day-2026-10-01")).toBeOnTheScreen();
		expect(screen.getByTestId("day-2026-10-31")).toBeOnTheScreen();
		expect(screen.queryByTestId("day-2026-11-01")).toBeNull();
	});

	it("reports the tapped day, and rules out days outside the bounds or that the caller rules out", async () => {
		const { onPick } = await renderGrid({ isUnavailable: (day: LocalDate): boolean => day === "2026-10-12" });

		await fireEvent.press(screen.getByTestId("day-2026-10-09"));
		expect(onPick).toHaveBeenCalledWith("2026-10-09");

		expect(screen.getByTestId("day-2026-10-01")).toBeDisabled();
		expect(screen.getByTestId("day-2026-10-21")).toBeDisabled();
		expect(screen.getByTestId("day-2026-10-12")).toBeDisabled();
		await fireEvent.press(screen.getByTestId("day-2026-10-12"));
		expect(onPick).toHaveBeenCalledTimes(1);
	});

	it("forwards its ref to its root view, and merges the caller's className last", async () => {
		const ref = React.createRef<View>();
		await renderGrid({ ref, className: "gap-1 px-2" });
		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("grid").props.className);
		expect(className).toContain("gap-1");
		expect(className).toContain("px-2");
		expect(className).not.toContain("gap-2");
	});
});
