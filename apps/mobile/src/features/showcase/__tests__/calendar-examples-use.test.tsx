import { fireEvent, screen } from "@testing-library/react-native";
import * as React from "react";

import { fakeDeviceBoundaries, pickEveryMenuItem, renderShowcaseExample, settle } from "../../../../test/showcase-example";
import { EventCalendar1Example } from "../examples/event-calendar/event-calendar-1";
import { EventCalendar3Example } from "../examples/event-calendar/event-calendar-3";
import { Gantt1Example } from "../examples/gantt/gantt-1";

beforeEach((): void => {
	jest.useFakeTimers();
	fakeDeviceBoundaries();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("the event calendar examples, used", () => {
	it("change the week, the hours, the shading and the time zone from the settings menu", async () => {
		await renderShowcaseExample(<EventCalendar1Example />);
		expect(await pickEveryMenuItem("Settings")).toBeGreaterThan(0);
		expect(screen.getByTestId("example")).toBeOnTheScreen();
	});

	it("add an event from the toolbar, edit it in the agenda, and delete it", async () => {
		await renderShowcaseExample(<EventCalendar3Example />);
		await fireEvent.press(screen.getByRole("button", { name: "New" }));
		await settle();
		expect(screen.getByText("New event")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Save" }));
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Month" }));
		await settle();
		await fireEvent.press(screen.getByRole("radio", { name: "Agenda" }));
		await settle();

		await fireEvent.press(screen.getByRole("button", { name: /^Untitled/u }));
		await settle();
		expect(screen.getByText("Edit event")).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByLabelText("Title"), "Board meeting");
		await fireEvent.press(screen.getByRole("radio", { name: "2 hours" }));
		await fireEvent.press(screen.getByRole("radio", { name: "Red" }));
		await fireEvent.press(screen.getByRole("button", { name: "Save" }));
		await settle();

		await fireEvent.press(screen.getByRole("button", { name: /^Board meeting/u }));
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Delete" }));
		await settle();
		expect(screen.queryByRole("button", { name: /^Board meeting/u })).toBeNull();
	});

	it("opens a blank form from a day, and closes it unsaved", async () => {
		await renderShowcaseExample(<EventCalendar3Example />);
		await fireEvent.press(screen.getByRole("button", { name: /^Monday, June 1st, 2026/u }));
		await settle();
		expect(screen.getByText("New event")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
		await settle();
		expect(screen.queryByText("New event")).toBeNull();
	});
});

/** The tasks Gantt1Example has waiting to be scheduled. */
const QUEUED_TASKS = 11;

describe("the gantt examples, used", () => {
	it("puts every queued task on the timeline, then has nothing left to add; and applies every setting", async () => {
		await renderShowcaseExample(<Gantt1Example />);
		for (let task = 0; task < QUEUED_TASKS; task += 1) {
			await fireEvent.press(screen.getByRole("button", { name: "Add task" }));
		}
		expect(screen.getByRole("button", { name: "Add task" })).toBeDisabled();
		expect(await pickEveryMenuItem("Settings")).toBeGreaterThan(0);
	});
});
