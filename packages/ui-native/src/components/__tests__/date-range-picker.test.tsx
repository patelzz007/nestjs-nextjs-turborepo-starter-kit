import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";
import type { View } from "react-native";

import { DateRangePicker, type LocalDateRange } from "../date-range-picker";

const TODAY = "2026-10-12";

function noIssue(): string | null {
	return null;
}

async function renderPicker(props: Partial<React.ComponentProps<typeof DateRangePicker>> = {}): Promise<{ readonly onApply: jest.Mock; readonly onClose: jest.Mock }> {
	const onApply = jest.fn();
	const onClose = jest.fn();
	await render(
		<DateRangePicker
			visible
			title="Choose dates"
			initialRange={{ from: "2026-10-01", to: "2026-10-05" }}
			minDate="2026-09-10"
			maxDate={TODAY}
			today={TODAY}
			locale="en-MY"
			validate={noIssue}
			onApply={onApply}
			onClose={onClose}
			testID="picker"
			{...props}
		/>,
	);
	return { onApply, onClose };
}

describe("DateRangePicker", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("opens on the range it is given, its ends and its days marked", async () => {
		await renderPicker();

		expect(screen.getByRole("button", { name: "Month: October" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Year: 2026" })).toBeOnTheScreen();
		expect(screen.getByLabelText("Start: 1 Oct 2026")).toBeOnTheScreen();
		expect(screen.getByLabelText("End: 5 Oct 2026")).toBeOnTheScreen();
		expect(screen.getByTestId("day-2026-10-01")).toHaveAccessibleName("Thursday, 1 October 2026, start");
		expect(screen.getByTestId("day-2026-10-03")).toHaveAccessibleName("Saturday, 3 October 2026, in range");
		expect(screen.getByTestId("day-2026-10-12")).toHaveAccessibleName("Monday, 12 October 2026, today");
		expect(screen.getByText("5 days")).toBeOnTheScreen();
	});

	it("picks a new start, then an end, and applies them", async () => {
		const { onApply } = await renderPicker();

		await fireEvent.press(screen.getByTestId("day-2026-10-06"));
		expect(screen.getByLabelText("End: not chosen")).toBeOnTheScreen();
		expect(screen.getByTestId("picker-apply")).toBeDisabled();
		await fireEvent.press(screen.getByTestId("day-2026-10-09"));
		await fireEvent.press(screen.getByTestId("picker-apply"));

		const applied: LocalDateRange = { from: "2026-10-06", to: "2026-10-09" };
		expect(onApply).toHaveBeenCalledWith(applied);
	});

	it("will not offer a day after the last or a month before the first", async () => {
		await renderPicker();

		expect(screen.getByTestId("day-2026-10-13")).toBeDisabled();
		expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: "Previous month" }));
		expect(screen.getByRole("button", { name: "Month: September" })).toBeOnTheScreen();
		expect(screen.getByTestId("day-2026-09-09")).toBeDisabled();
		expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
	});

	it("jumps to a chosen year and month, keeping the range picked so far", async () => {
		await renderPicker({ minDate: "2020-01-01" });

		await fireEvent.press(screen.getByRole("button", { name: "Year: 2026" }));
		await fireEvent.press(screen.getByTestId("year-2021"));
		await fireEvent.press(screen.getByRole("button", { name: "Month: October" }));
		await fireEvent.press(screen.getByTestId("month-3"));

		expect(screen.getByRole("button", { name: "Month: March" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Year: 2021" })).toBeOnTheScreen();
		expect(screen.getByTestId("day-2021-03-15")).toHaveAccessibleName("Monday, 15 March 2021");
		expect(screen.getByLabelText("Start: 1 Oct 2026")).toBeOnTheScreen();
	});

	it("says why a range cannot be applied, and holds Apply back", async () => {
		await renderPicker({ validate: (): string => "Too long" });

		expect(screen.getByText("Too long")).toBeOnTheScreen();
		expect(screen.getByTestId("picker-apply")).toBeDisabled();
	});

	it("closes without applying", async () => {
		const { onApply, onClose } = await renderPicker();

		await fireEvent.press(screen.getByRole("button", { name: "Close choose dates" }));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onApply).not.toHaveBeenCalled();
	});

	it("starts empty without a range, and draws nothing while closed", async () => {
		await renderPicker({ initialRange: null });
		expect(screen.getByLabelText("Start: not chosen")).toBeOnTheScreen();
		expect(screen.getByText("Tap a start date, then an end date. Tap a date twice for a single day.")).toBeOnTheScreen();

		await renderPicker({ visible: false });
		expect(screen.queryByText("Choose dates")).toBeNull();
	});

	it("forwards its ref while open, and merges the caller's className onto the sheet", async () => {
		const ref = React.createRef<View>();
		await renderPicker({ ref, className: "pb-12" });
		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("picker").props.className);
		expect(className).toContain("pb-12");
		expect(className).not.toContain("pb-8");
	});
});
