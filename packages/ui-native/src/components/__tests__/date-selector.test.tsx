import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";
import type { ViewInstance } from "react-native";

import type { DateSelectorValue } from "../../lib/date-selector";
import { SHEET_MOTION } from "../../lib/motion";
import { DateSelector, DateSelectorField } from "../date-selector";

const BOUNDS = { today: "2026-11-15", minYear: 2024, maxYear: 2027, locale: "en-GB" };

describe("DateSelector", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("picks a day on the calendar, and switches the filter and the period", async () => {
		const onChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(<DateSelector ref={ref} {...BOUNDS} value={{ period: "day", operator: "is" }} onChange={onChange} variant="card" />);
		await fireEvent.press(screen.getByTestId("day-2026-11-20"));
		expect(onChange).toHaveBeenLastCalledWith({ period: "day", operator: "is", startDate: "2026-11-20", endDate: undefined });
		await fireEvent.press(screen.getByRole("radio", { name: "Before" }));
		expect(onChange).toHaveBeenLastCalledWith({ period: "day", operator: "before" });
		await fireEvent.press(screen.getByRole("radio", { name: "Quarter" }));
		expect(onChange).toHaveBeenLastCalledWith({ period: "quarter", operator: "is" });
		expect(ref.current).not.toBeNull();
	});

	it("picks a year's quarters, a range between two, and steps the year", async () => {
		const onChange = jest.fn();
		const value: DateSelectorValue = { period: "quarter", operator: "between", rangeStart: { year: 2026, value: 0 } };
		await render(<DateSelector {...BOUNDS} value={value} onChange={onChange} />);
		expect(screen.getByRole("button", { name: "Q1 2026" })).toBeSelected();
		await fireEvent.press(screen.getByRole("button", { name: "Q3 2026" }));
		expect(onChange).toHaveBeenLastCalledWith({ ...value, rangeEnd: { year: 2026, value: 2 } });
		await fireEvent.press(screen.getByRole("button", { name: "Next year" }));
		expect(screen.getByRole("header", { name: "2027" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Next year" })).toBeDisabled();
	});

	it("reads typed text, says when it cannot, and picks today or clears", async () => {
		const onChange = jest.fn();
		await render(
			<DateSelector {...BOUNDS} value={{ period: "month", operator: "is", year: 2026, month: 1 }} onChange={onChange} presetMode="is" periodTypes={["month", "year"]} />,
		);
		expect(screen.queryByRole("radio", { name: "Before" })).toBeNull();
		const input = screen.getByLabelText("Type a date, Q1 2026 or 2026");
		await fireEvent.changeText(input, "someday");
		await fireEvent(input, "submitEditing");
		expect(screen.getByRole("alert")).toBeOnTheScreen();
		await fireEvent.changeText(input, "2025");
		await fireEvent(input, "submitEditing");
		expect(onChange).toHaveBeenLastCalledWith({ period: "year", operator: "is", year: 2025 });
		await fireEvent.press(screen.getByRole("button", { name: "Today" }));
		expect(onChange).toHaveBeenLastCalledWith({ period: "month", operator: "is", year: 2026, month: 10 });
		await fireEvent.press(screen.getByRole("button", { name: "Clear" }));
		expect(onChange).toHaveBeenLastCalledWith({ period: "month", operator: "is" });
	});

	it("lists the years, and starts weeks on Sunday when asked", async () => {
		await render(<DateSelector {...BOUNDS} value={{ period: "year", operator: "after", year: 2025 }} onChange={jest.fn()} showInput={false} allowRange={false} />);
		expect(screen.getByRole("button", { name: "2025" })).toBeSelected();
		expect(screen.queryByRole("radio", { name: "Between" })).toBeNull();
		await render(<DateSelector {...BOUNDS} value={{ period: "day", operator: "is" }} onChange={jest.fn()} weekStartsOn={0} />);
		expect(screen.getAllByText("S", { includeHiddenElements: true }).length).toBeGreaterThan(0);
	});
});

describe("DateSelectorField", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("shows the value, and applies a draft only on Apply", async () => {
		const onChange = jest.fn();
		await render(<DateSelectorField label="Due" {...BOUNDS} value={{ period: "year", operator: "before", year: 2025 }} onChange={onChange} />);
		const field = screen.getByRole("button", { name: "Due, Before 2025" });
		await fireEvent.press(field);
		await fireEvent.press(screen.getByRole("button", { name: "2026" }));
		expect(onChange).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		expect(onChange).toHaveBeenCalledWith({ period: "year", operator: "before", year: 2026 });
		await act((): void => {
			jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
		});
		await render(<DateSelectorField label="Due" {...BOUNDS} value={{ period: "year", operator: "is" }} onChange={jest.fn()} />);
		expect(screen.getByRole("button", { name: "Due, none picked" })).toBeOnTheScreen();
	});
});
