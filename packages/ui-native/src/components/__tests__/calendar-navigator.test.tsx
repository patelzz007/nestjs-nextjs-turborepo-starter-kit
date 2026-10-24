import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import type { CalendarMonth } from "../../lib/calendar";
import { CalendarNavigator } from "../calendar-navigator";

const MIN_MONTH: CalendarMonth = { year: 2023, month: 4 };
const MAX_MONTH: CalendarMonth = { year: 2026, month: 10 };

async function renderNavigator(month: CalendarMonth = MAX_MONTH): Promise<{ readonly onMonthChange: jest.Mock }> {
	const onMonthChange = jest.fn();
	await render(
		<CalendarNavigator month={month} minMonth={MIN_MONTH} maxMonth={MAX_MONTH} locale="en-MY" onMonthChange={onMonthChange}>
			<Text testID="days">days</Text>
		</CalendarNavigator>,
	);
	return { onMonthChange };
}

describe("CalendarNavigator", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("shows the days under the shown month and year, and steps a month at a time", async () => {
		const { onMonthChange } = await renderNavigator({ year: 2025, month: 1 });

		expect(screen.getByTestId("days")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Month: January" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Year: 2025" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Previous month" }));
		expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2024, month: 12 });
		await fireEvent.press(screen.getByRole("button", { name: "Next month" }));
		expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2025, month: 2 });
	});

	it("lists the shown year's months in place of the days, and goes back to the days on a choice", async () => {
		const { onMonthChange } = await renderNavigator();

		await fireEvent.press(screen.getByRole("button", { name: "Month: October" }));
		expect(screen.queryByTestId("days")).toBeNull();
		expect(screen.getByRole("button", { name: "Month: October" })).toBeExpanded();
		expect(screen.queryByRole("button", { name: "Previous month" })).toBeNull();
		expect(screen.getByTestId("month-10")).toHaveAccessibleName("October 2026");
		expect(screen.getByTestId("month-10")).toBeSelected();
		expect(screen.getByTestId("month-11")).toBeDisabled();

		await fireEvent.press(screen.getByTestId("month-1"));
		expect(onMonthChange).toHaveBeenCalledWith({ year: 2026, month: 1 });
		expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
		expect(screen.getByTestId("days")).toBeOnTheScreen();
	});

	it("closes the months again on a second tap without choosing", async () => {
		const { onMonthChange } = await renderNavigator();

		await fireEvent.press(screen.getByRole("button", { name: "Month: October" }));
		await fireEvent.press(screen.getByRole("button", { name: "Month: October" }));
		expect(screen.getByTestId("days")).toBeOnTheScreen();
		expect(onMonthChange).not.toHaveBeenCalled();
	});

	it("lists every year in range and keeps the month on a choice", async () => {
		const { onMonthChange } = await renderNavigator({ year: 2026, month: 6 });

		await fireEvent.press(screen.getByRole("button", { name: "Year: 2026" }));
		expect(screen.getByTestId("year-list")).toBeOnTheScreen();
		expect(screen.getByTestId("year-2023")).toBeOnTheScreen();
		expect(screen.getByTestId("year-2026")).toBeSelected();
		expect(screen.queryByTestId("year-2022")).toBeNull();
		expect(screen.queryByTestId("year-2027")).toBeNull();

		await fireEvent.press(screen.getByTestId("year-2024"));
		expect(onMonthChange).toHaveBeenCalledWith({ year: 2024, month: 6 });
		expect(screen.getByTestId("days")).toBeOnTheScreen();
	});

	it("lands a year whose month is out of range on the nearest month in range", async () => {
		const { onMonthChange } = await renderNavigator({ year: 2025, month: 1 });

		await fireEvent.press(screen.getByRole("button", { name: "Year: 2025" }));
		await fireEvent.press(screen.getByTestId("year-2023"));
		expect(onMonthChange).toHaveBeenCalledWith(MIN_MONTH);
	});

	it("disables the months before the first in the first year", async () => {
		await renderNavigator({ year: 2023, month: 6 });

		await fireEvent.press(screen.getByRole("button", { name: "Month: June" }));
		expect(screen.getByTestId("month-3")).toBeDisabled();
		expect(screen.getByTestId("month-4")).toBeEnabled();
	});

	it("forwards its ref to its root view, and merges the caller's className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(
			<CalendarNavigator ref={ref} month={MAX_MONTH} minMonth={MIN_MONTH} maxMonth={MAX_MONTH} locale="en-MY" onMonthChange={jest.fn()} className="gap-4" testID="navigator">
				<Text>days</Text>
			</CalendarNavigator>,
		);
		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("navigator").props.className);
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-2");
	});
});
