import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";

import { OverlayDemos } from "../overlay-demos";

const DEMO_TITLES: readonly string[] = ["Dialog", "AlertDialog", "BottomSheet", "DropdownMenu", "Tooltip", "Accordion", "Collapsible", "Tabs", "Toast"];

describe("OverlayDemos", () => {
	it("shows one demo block per component", async () => {
		await render(<OverlayDemos />);
		for (const title of DEMO_TITLES) {
			expect(within(screen.getByTestId(`demo-${title}`)).getByText(title)).toBeOnTheScreen();
		}
	});

	it("opens the dialog and closes it from its footer", async () => {
		await render(<OverlayDemos />);
		expect(screen.queryByText("Rename project")).toBeNull();

		await fireEvent.press(screen.getByTestId("gallery-dialog-open"));
		expect(screen.getByRole("header", { name: "Rename project" })).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Done" }));
		expect(screen.queryByText("Rename project")).toBeNull();
	});

	it("confirms the alert dialog and reports the outcome", async () => {
		await render(<OverlayDemos />);

		await fireEvent.press(screen.getByTestId("gallery-alert-dialog-open"));
		await fireEvent.press(screen.getByRole("button", { name: "Revoke" }));

		expect(screen.queryByText("Revoke this device?")).toBeNull();
		expect(screen.getByText("Device revoked (demo only).")).toBeOnTheScreen();
	});

	it("picks a sort order in the bottom sheet", async () => {
		await render(<OverlayDemos />);

		await fireEvent.press(screen.getByTestId("gallery-bottom-sheet-open"));
		await fireEvent.press(screen.getByRole("radio", { name: "Recently updated" }));

		expect(screen.getByText("Sorted: Recently updated")).toBeOnTheScreen();
		expect(screen.queryByRole("radio", { name: "Recently updated" })).toBeNull();
	});

	it("chooses an action from the dropdown menu", async () => {
		await render(<OverlayDemos />);

		await fireEvent.press(screen.getByTestId("gallery-dropdown-menu"));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Delete" }));

		expect(screen.getByText("Chose: delete")).toBeOnTheScreen();
	});

	it("switches tabs, keeping both tab lists in step", async () => {
		await render(<OverlayDemos />);
		expect(screen.getByText("Three services, all healthy.")).toBeOnTheScreen();

		const [firstActivity] = screen.getAllByRole("tab", { name: "Activity" });
		if (firstActivity === undefined) {
			throw new Error("No Activity tab.");
		}
		await fireEvent.press(firstActivity);

		expect(screen.getByText("Deployed 2 hours ago.")).toBeOnTheScreen();
		for (const tab of screen.getAllByRole("tab", { name: "Activity" })) {
			expect(tab).toBeSelected();
		}
	});

	it("opens the accordion's next question and the collapsible's details", async () => {
		await render(<OverlayDemos />);
		expect(screen.getByText("On the first of each month, for the month ahead.")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Can I export my data?" }));
		expect(screen.getByText("Every project exports as a zip from its settings.")).toBeOnTheScreen();
		expect(screen.queryByText("On the first of each month, for the month ahead.")).toBeNull();

		await fireEvent.press(screen.getByRole("button", { name: "Build details" }));
		expect(screen.getByText("Install 12 s · Build 48 s · Test 1 min 05 s")).toBeOnTheScreen();
	});

	it("draws a toast inline and moves to the next tone", async () => {
		await render(<OverlayDemos />);
		expect(screen.getByText("Profile saved.")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Next tone" }));
		expect(screen.getByText("A new version is available.")).toBeOnTheScreen();
	});
});
