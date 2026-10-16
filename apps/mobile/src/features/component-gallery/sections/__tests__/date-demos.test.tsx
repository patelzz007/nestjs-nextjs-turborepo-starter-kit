import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";

import { DateDemos } from "../date-demos";

/** Midday on 16 October 2026 in the display zone (UTC+8): "today" is 2026-10-16. */
const NOW_MS = Date.UTC(2026, 9, 16, 4);

const DEMO_TITLES: readonly string[] = ["DateField", "MultiDateField", "DateRangePicker", "CalendarNavigator", "IconButton"];

describe("DateDemos", () => {
	beforeEach(() => {
		jest.spyOn(Date, "now").mockReturnValue(NOW_MS);
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("shows one demo block per component", async () => {
		await render(<DateDemos />);
		for (const title of DEMO_TITLES) {
			expect(within(screen.getByTestId(`demo-${title}`)).getByText(title)).toBeOnTheScreen();
		}
	});

	it("picks a day on the inline calendar, which rings today", async () => {
		await render(<DateDemos />);

		expect(screen.getByTestId("day-2026-10-16")).toHaveAccessibleName("Friday, 16 October 2026, today");
		expect(screen.getByTestId("day-2026-10-15")).toBeDisabled();
		await fireEvent.press(screen.getByTestId("day-2026-10-20"));

		expect(screen.getByTestId("day-2026-10-20")).toBeSelected();
		expect(screen.getByText("Picked: 20 October 2026")).toBeOnTheScreen();
	});

	it("picks a date of birth, and shows the error when the calendar closes without one", async () => {
		await render(<DateDemos />);

		await fireEvent.press(screen.getByTestId("gallery-date-field"));
		await fireEvent.press(screen.getByRole("button", { name: "Close date of birth" }));
		expect(screen.getByText("Pick your date of birth.")).toBeOnTheScreen();

		await fireEvent.press(screen.getByTestId("gallery-date-field"));
		await fireEvent.press(within(screen.getByTestId("gallery-date-field-sheet")).getByTestId("day-2026-10-01"));
		expect(screen.getByRole("button", { name: "Date of birth, 1 October 2026" })).toBeOnTheScreen();
		expect(screen.queryByText("Pick your date of birth.")).toBeNull();
	});

	it("opens the range picker from its button and applies a new range", async () => {
		await render(<DateDemos />);
		expect(screen.getByText("9 Oct 2026 – 15 Oct 2026")).toBeOnTheScreen();

		await fireEvent.press(screen.getByTestId("gallery-range-open"));
		const picker = screen.getByTestId("gallery-range-picker");
		await fireEvent.press(within(picker).getByTestId("day-2026-10-01"));
		await fireEvent.press(within(picker).getByTestId("day-2026-10-03"));
		await fireEvent.press(screen.getByTestId("gallery-range-picker-apply"));

		expect(screen.getByText("1 Oct 2026 – 3 Oct 2026")).toBeOnTheScreen();
		expect(screen.queryByTestId("gallery-range-picker")).toBeNull();
	});

	it("toggles the like icon button, and keeps the disabled one inert", async () => {
		await render(<DateDemos />);

		await fireEvent.press(screen.getByRole("button", { name: "Like" }));
		expect(screen.getByRole("button", { name: "Unlike" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Delete (disabled)" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Delete (busy)" })).toBeBusy();
	});
});
