import type { LocalDate } from "@workspace/shared";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { MultiDateField } from "../multi-date-field";

const TODAY: LocalDate = "2026-10-16";

async function renderField(props: Partial<React.ComponentProps<typeof MultiDateField>> = {}): Promise<{ readonly onChange: jest.Mock }> {
	const onChange = jest.fn();
	await render(
		<MultiDateField
			label="Delivery days"
			value={[]}
			onChange={onChange}
			placeholder="Pick the days"
			minDate="2026-01-01"
			maxDate="2027-12-31"
			today={TODAY}
			locale="en-MY"
			testID="days"
			{...props}
		/>,
	);
	return { onChange };
}

describe("MultiDateField", () => {
	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("lists the picked days in the field", async () => {
		await renderField({ value: ["2026-09-04", "2026-09-14", "2026-10-03"] });
		expect(screen.getByRole("button", { name: "Delivery days, 4 Sept 2026, 14 Sept 2026, 3 Oct 2026" })).toBeOnTheScreen();
	});

	it("picks days across months, in date order, and applies them", async () => {
		const { onChange } = await renderField();

		await fireEvent.press(screen.getByTestId("days"));
		expect(screen.getByText("Tap each date you want. Tap it again to remove it.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("day-2026-10-03"));
		await fireEvent.press(screen.getByRole("button", { name: "Previous month" }));
		await fireEvent.press(screen.getByTestId("day-2026-09-14"));
		await fireEvent.press(screen.getByTestId("day-2026-09-04"));

		expect(screen.getByTestId("day-2026-09-04")).toHaveAccessibleName("Friday, 4 September 2026, selected");
		expect(screen.getByText("3 dates picked")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("days-apply"));

		expect(onChange).toHaveBeenCalledWith(["2026-09-04", "2026-09-14", "2026-10-03"]);
		expect(screen.queryByTestId("days-apply")).toBeNull();
	});

	it("unpicks a day tapped again or removed from its chip", async () => {
		const { onChange } = await renderField({ value: ["2026-10-03", "2026-10-05", "2026-10-09"] });

		await fireEvent.press(screen.getByTestId("days"));
		await fireEvent.press(screen.getByTestId("day-2026-10-05"));
		await fireEvent.press(screen.getByRole("button", { name: "Remove 9 Oct 2026" }));
		await fireEvent.press(screen.getByTestId("days-apply"));

		expect(onChange).toHaveBeenCalledWith(["2026-10-03"]);
	});

	it("rules out the unpicked days at the cap, and says so", async () => {
		const { onChange } = await renderField({ value: ["2026-10-03"], maxDates: 2 });

		await fireEvent.press(screen.getByTestId("days"));
		await fireEvent.press(screen.getByTestId("day-2026-10-05"));
		expect(screen.getByTestId("day-2026-10-07")).toBeDisabled();
		expect(screen.getByTestId("day-2026-10-05")).toBeEnabled();

		expect(screen.getByText("2 of 2 dates picked. Remove one to pick another.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByTestId("days-apply"));
		expect(onChange).toHaveBeenCalledWith(["2026-10-03", "2026-10-05"]);
	});

	it("clears the draft, and keeps the field as it was on Cancel", async () => {
		const { onChange } = await renderField({ value: ["2026-10-03"] });

		await fireEvent.press(screen.getByTestId("days"));
		await fireEvent.press(screen.getByRole("button", { name: "Clear" }));
		expect(screen.queryByRole("button", { name: "Remove 3 Oct 2026" })).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));

		expect(onChange).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Delivery days, 3 Oct 2026" })).toBeOnTheScreen();
	});

	it("opens on the first picked day's month", async () => {
		await renderField({ value: ["2027-02-10", "2027-05-01"] });
		await fireEvent.press(screen.getByTestId("days"));
		expect(screen.getByRole("button", { name: "Month: February" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Year: 2027" })).toBeOnTheScreen();
	});

	it("reports focus when the calendar opens and blur when it closes", async () => {
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await renderField({ onFocus, onBlur });

		await fireEvent.press(screen.getByTestId("days"));
		expect(onFocus).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it("forwards its ref to the field's trigger, and merges the caller's className onto the field", async () => {
		const ref = React.createRef<ViewInstance>();
		await renderField({ ref, className: "flex-1" });
		expect(ref.current).not.toBeNull();
		expect(screen.getByText("Delivery days").parent).toHaveProp("className", expect.stringContaining("flex-1"));
		expect(screen.getByTestId("days")).not.toHaveProp("className", expect.stringContaining("flex-1"));
	});

	it("takes the caller's invalid outcome as its error state, and its compact filled look", async () => {
		await renderField({ invalid: true, variant: "filled", size: "sm" });
		const trigger = screen.getByTestId("days");
		expect(trigger).toHaveProp("className", expect.stringContaining("border-destructive"));
		expect(trigger).toHaveProp("className", expect.stringContaining("bg-muted"));
		expect(trigger).toHaveProp("className", expect.stringContaining("min-h-11"));
	});
});
