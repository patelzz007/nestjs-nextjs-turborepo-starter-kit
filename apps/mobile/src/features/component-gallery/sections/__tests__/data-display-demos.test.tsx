import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";

import { DataDisplayDemos } from "../data-display-demos";

const DEMO_TITLES: readonly string[] = ["DetailList", "ListRow", "StatTiles", "Timeline", "TimelineRailItem", "Table", "RelativeTime", "Pagination", "Stepper", "ButtonGroup"];

describe("DataDisplayDemos", () => {
	it("shows one demo block per component", async () => {
		await render(<DataDisplayDemos />);
		for (const title of DEMO_TITLES) {
			expect(within(screen.getByTestId(`demo-${title}`)).getByText(title)).toBeOnTheScreen();
		}
	});

	it("pages through the orders, disabling each end", async () => {
		await render(<DataDisplayDemos />);
		const pager = within(screen.getByTestId("demo-Pagination"));

		expect(pager.getByText("Page 1 of 3")).toBeOnTheScreen();
		expect(pager.getByLabelText("#1041 · Aisyah: Total RM 42.00")).toBeOnTheScreen();
		expect(pager.getByRole("button", { name: "Previous" })).toBeDisabled();

		await fireEvent.press(pager.getByRole("button", { name: "Next" }));
		expect(pager.getByText("Page 2 of 3")).toBeOnTheScreen();
		expect(pager.getByLabelText("#1038 · Arjun: Total RM 12.00")).toBeOnTheScreen();

		await fireEvent.press(pager.getByRole("button", { name: "Next" }));
		expect(pager.getByText("Page 3 of 3")).toBeOnTheScreen();
		expect(pager.getByLabelText("#1035 · Nurul: Total RM 74.25")).toBeOnTheScreen();
		expect(pager.getByRole("button", { name: "Next" })).toBeDisabled();

		await fireEvent.press(pager.getByRole("button", { name: "Previous" }));
		expect(pager.getByText("Page 2 of 3")).toBeOnTheScreen();
	});

	it("words times against the demo's fixed clock", async () => {
		await render(<DataDisplayDemos />);
		const block = within(screen.getByTestId("demo-RelativeTime"));

		expect(block.getByText("3 minutes ago")).toBeOnTheScreen();
		expect(block.getByText("5 hours ago")).toBeOnTheScreen();
		expect(block.getByText("in 2 days")).toBeOnTheScreen();
	});

	it("steps through checkout with the buttons and by tapping a step", async () => {
		await render(<DataDisplayDemos />);
		const block = within(screen.getByTestId("demo-Stepper"));

		expect(block.getByRole("tab", { name: "Step 2 of 4: Shipping, current" })).toBeSelected();
		await fireEvent.press(block.getByRole("button", { name: "Continue" }));
		expect(block.getByRole("tab", { name: "Step 3 of 4: Payment, current" })).toBeSelected();
		await fireEvent.press(block.getByRole("tab", { name: "Step 1 of 4: Details, completed" }));
		expect(block.getByRole("tab", { name: "Step 1 of 4: Details, current" })).toBeSelected();
		expect(block.getByRole("button", { name: "Back" })).toBeDisabled();
		expect(block.getByLabelText("Step 3 of 4: Out for delivery, current")).toBeOnTheScreen();
	});

	it("cycles the theme row and picks a chart interval", async () => {
		await render(<DataDisplayDemos />);

		await fireEvent.press(screen.getByRole("button", { name: "Appearance, System" }));
		expect(screen.getByRole("button", { name: "Appearance, Light" })).toBeOnTheScreen();

		const group = within(screen.getByTestId("demo-ButtonGroup"));
		await fireEvent.press(group.getByRole("button", { name: "Month" }));
		expect(group.getByText("Interval: month")).toBeOnTheScreen();
	});
});
