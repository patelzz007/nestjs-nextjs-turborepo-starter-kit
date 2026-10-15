import type { LocalDate } from "@workspace/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";

import { DateField } from "./date-field";

const TODAY: LocalDate = "2026-10-16";

async function renderField(props: Partial<React.ComponentProps<typeof DateField>> = {}): Promise<{ readonly onChange: jest.Mock; readonly onBlur: jest.Mock }> {
	const onChange = jest.fn();
	const onBlur = jest.fn();
	await render(
		<DateField
			label="Date of birth"
			value={null}
			onChange={onChange}
			onBlur={onBlur}
			placeholder="Pick your birthday"
			minDate="1926-01-01"
			maxDate={TODAY}
			today={TODAY}
			locale="en-MY"
			testID="dob"
			{...props}
		/>,
	);
	return { onChange, onBlur };
}

describe("DateField", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("shows the placeholder while empty, and the picked day once set", async () => {
		await renderField();
		expect(screen.getByRole("button", { name: "Date of birth, none picked" })).toBeOnTheScreen();
		expect(screen.getByText("Pick your birthday")).toBeOnTheScreen();

		await renderField({ value: "1990-03-15" });
		expect(screen.getByRole("button", { name: "Date of birth, 15 March 1990" })).toBeOnTheScreen();
	});

	it("opens on today's month while empty, and on the picked day's month once set", async () => {
		await renderField();
		await fireEvent.press(screen.getByTestId("dob"));
		expect(screen.getByRole("button", { name: "Month: October" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Year: 2026" })).toBeOnTheScreen();

		await renderField({ value: "1990-03-15" });
		await fireEvent.press(screen.getByTestId("dob"));
		expect(screen.getByRole("button", { name: "Year: 1990" })).toBeOnTheScreen();
		expect(screen.getByTestId("day-1990-03-15")).toHaveAccessibleName("Thursday, 15 March 1990, selected");
	});

	it("jumps to a birth year and month, then picks a day and closes", async () => {
		const { onChange, onBlur } = await renderField();

		await fireEvent.press(screen.getByTestId("dob"));
		await fireEvent.press(screen.getByRole("button", { name: "Year: 2026" }));
		await fireEvent.press(screen.getByTestId("year-1990"));
		await fireEvent.press(screen.getByRole("button", { name: "Month: October" }));
		await fireEvent.press(screen.getByTestId("month-3"));
		await fireEvent.press(screen.getByTestId("day-1990-03-15"));

		expect(onChange).toHaveBeenCalledWith("1990-03-15");
		expect(onBlur).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId("day-1990-03-15")).toBeNull();
	});

	it("will not pick a day after the last", async () => {
		await renderField();
		await fireEvent.press(screen.getByTestId("dob"));
		expect(screen.getByTestId("day-2026-10-17")).toBeDisabled();
	});

	it("closes without a change on the close button or when the picked day is tapped again", async () => {
		const { onChange, onBlur } = await renderField({ value: "2026-10-01" });

		await fireEvent.press(screen.getByTestId("dob"));
		await fireEvent.press(screen.getByTestId("day-2026-10-01"));
		await fireEvent.press(screen.getByTestId("dob"));
		await fireEvent.press(screen.getByRole("button", { name: "Close date of birth" }));

		expect(onChange).not.toHaveBeenCalled();
		expect(onBlur).toHaveBeenCalledTimes(2);
	});

	it("shows an error in place of the hint, and cannot open while disabled", async () => {
		await renderField({ hint: "You must be 18 or older.", error: "Pick a date." });
		expect(screen.getByText("Pick a date.")).toBeOnTheScreen();
		expect(screen.queryByText("You must be 18 or older.")).toBeNull();

		await renderField({ hint: "You must be 18 or older.", disabled: true });
		expect(screen.getByText("You must be 18 or older.")).toBeOnTheScreen();
		expect(screen.getByTestId("dob")).toBeDisabled();
	});
});
