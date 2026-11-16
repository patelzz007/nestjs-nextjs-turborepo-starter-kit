import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { displayTime, formatTimeValue, isTimePickable, parseTime, parseTypedTime, TimePicker, TimePickerPanel } from "../time-picker";

describe("the time helpers", () => {
	it("read and write a time of day", () => {
		expect(parseTime("14:05")).toStrictEqual({ hours: 14, minutes: 5, seconds: 0 });
		expect(parseTime("09:30:15")).toStrictEqual({ hours: 9, minutes: 30, seconds: 15 });
		expect(parseTime("25:00")).toBeNull();
		expect(parseTime(null)).toBeNull();
		expect(formatTimeValue({ hours: 7, minutes: 5, seconds: 9 }, true)).toBe("07:05:09");
	});

	it("read a typed time, on either clock", () => {
		expect(parseTypedTime("2:30 pm")).toBe("14:30");
		expect(parseTypedTime("12 am")).toBe("00:00");
		expect(parseTypedTime("1430")).toBe("14:30");
		expect(parseTypedTime("9")).toBe("09:00");
		expect(parseTypedTime("13 pm")).toBeNull();
		expect(parseTypedTime("soon")).toBeNull();
	});

	it("show a time the way the clock reads it", () => {
		expect(displayTime("14:45:30", 12)).toBe("02:45:30 PM");
		expect(displayTime("00:10", 12)).toBe("12:10 AM");
		expect(displayTime("14:45", 24)).toBe("14:45");
	});

	it("say whether a time can be picked within the bounds and the caller's rule", () => {
		const options = { min: "08:30", max: "18:00", isTimeDisabled: (value: string): boolean => value.startsWith("12:") };
		expect(isTimePickable({ hours: 8, minutes: 0, seconds: 0 }, options)).toBe(false);
		expect(isTimePickable({ hours: 12, minutes: 30, seconds: 0 }, options)).toBe(false);
		expect(isTimePickable({ hours: 9, minutes: 0, seconds: 0 }, options)).toBe(true);
	});
});

/** The lunch hour, booked out. */
function isLunch(value: string): boolean {
	return value.startsWith("12:");
}

describe("TimePickerPanel", () => {
	it("sets the value from any column, and greys out an hour with no free minute", async () => {
		const onChange = jest.fn();
		await render(<TimePickerPanel value="09:00" onChange={onChange} minuteStep={15} isTimeDisabled={isLunch} />);
		await fireEvent.press(screen.getByRole("button", { name: "10, Hours" }));
		expect(onChange).toHaveBeenLastCalledWith("10:00");
		await fireEvent.press(screen.getByRole("button", { name: "45, Minutes" }));
		expect(onChange).toHaveBeenLastCalledWith("09:45");
		expect(screen.getByRole("button", { name: "12, Hours" })).toBeDisabled();
		expect(screen.queryByRole("button", { name: "07, Hours" })).toBeOnTheScreen();
	});

	it("has a period column on a 12-hour clock, and a seconds column when asked", async () => {
		const onChange = jest.fn();
		await render(<TimePickerPanel value="09:15:00" onChange={onChange} hourCycle={12} withSeconds />);
		await fireEvent.press(screen.getByRole("button", { name: "PM, AM or PM" }));
		expect(onChange).toHaveBeenLastCalledWith("21:15:00");
		expect(screen.getByLabelText("Seconds")).toBeOnTheScreen();
	});
});

describe("TimePicker", () => {
	it("opens the columns in a sheet from a field showing the time, and commits each pick", async () => {
		const onChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(<TimePicker ref={ref} label="Start" value="14:30" onChange={onChange} hourCycle={12} testID="time" />);
		expect(screen.getByText("02:30 PM")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("combobox", { name: /Start/u }));
		await fireEvent.press(within(screen.getByTestId("time-sheet")).getByRole("button", { name: "04, Hours" }));
		expect(onChange).toHaveBeenLastCalledWith("16:30");
		expect(ref.current).not.toBeNull();
	});

	it("holds a draft until Done when confirming, and offers Now and Clear", async () => {
		const onChange = jest.fn();
		await render(<TimePicker label="Start" value="09:00" onChange={onChange} confirm showActions now="11:20" testID="time" />);
		await fireEvent.press(screen.getByRole("combobox", { name: /Start/u }));
		const sheet = screen.getByTestId("time-sheet");
		await fireEvent.press(within(sheet).getByRole("button", { name: "Now" }));
		expect(onChange).not.toHaveBeenCalled();
		await fireEvent.press(within(sheet).getByRole("button", { name: "Done" }));
		expect(onChange).toHaveBeenLastCalledWith("11:20");
		await fireEvent.press(screen.getByRole("combobox", { name: /Start/u }));
		await fireEvent.press(within(screen.getByTestId("time-sheet")).getByRole("button", { name: "Clear" }));
		await fireEvent.press(within(screen.getByTestId("time-sheet")).getByRole("button", { name: "Done" }));
		expect(onChange).toHaveBeenLastCalledWith(null);
	});
});
