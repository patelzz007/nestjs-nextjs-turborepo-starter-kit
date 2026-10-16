import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";

import { DisplayDemos } from "../display-demos";

const DEMO_TITLES: readonly string[] = [
	"Avatar",
	"Badge",
	"StatusBadge",
	"Alert",
	"Card",
	"Separator",
	"IconTile",
	"AspectRatio",
	"Spinner",
	"Progress",
	"PulseDot",
	"Skeleton",
	"LoadingState",
	"EmptyState",
	"ErrorState",
];

/** The demo upload's file count: pressing Forward this often from empty fills the bar. */
const UPLOAD_FILES = 5;

describe("DisplayDemos", () => {
	it("shows one demo block per component", async () => {
		await render(<DisplayDemos />);
		for (const title of DEMO_TITLES) {
			expect(within(screen.getByTestId(`demo-${title}`)).getByText(title)).toBeOnTheScreen();
		}
	});

	it("steps the upload forward and back, disabling each end", async () => {
		await render(<DisplayDemos />);
		const block = within(screen.getByTestId("demo-Progress"));

		expect(block.getByRole("progressbar", { name: "Uploading files" })).toHaveAccessibilityValue({ min: 0, max: 5, now: 2, text: "2 of 5 files" });
		await fireEvent.press(block.getByRole("button", { name: "Back" }));
		await fireEvent.press(block.getByRole("button", { name: "Back" }));
		expect(block.getByRole("progressbar", { name: "Uploading files" })).toHaveAccessibilityValue({ min: 0, max: 5, now: 0, text: "0 of 5 files" });
		expect(block.getByRole("button", { name: "Back" })).toBeDisabled();

		for (let pressed = 0; pressed < UPLOAD_FILES; pressed += 1) {
			await fireEvent.press(block.getByRole("button", { name: "Forward" }));
		}
		expect(block.getByText("5 of 5 files")).toBeOnTheScreen();
		expect(block.getByRole("button", { name: "Forward" })).toBeDisabled();
	});

	it("retries from the error state and the alert", async () => {
		await render(<DisplayDemos />);

		const errorBlock = within(screen.getByTestId("demo-ErrorState"));
		expect(errorBlock.getByRole("alert")).toHaveTextContent("Could not load your devices.");
		await fireEvent.press(errorBlock.getByRole("button", { name: "Try again" }));
		expect(errorBlock.getByRole("alert")).toHaveTextContent("Still failing after 1 retries.");

		const alertBlock = within(screen.getByTestId("demo-Alert"));
		await fireEvent.press(alertBlock.getByRole("button", { name: "Try again" }));
		expect(alertBlock.getByText("Retried 1 times.")).toBeOnTheScreen();
	});

	it("announces the loading examples by what they load", async () => {
		await render(<DisplayDemos />);

		expect(within(screen.getByTestId("demo-LoadingState")).getByRole("progressbar", { name: "Loading your devices…" })).toBeOnTheScreen();
		expect(within(screen.getByTestId("demo-Skeleton")).getByRole("progressbar", { name: "Loading an example profile" })).toBeBusy();
		expect(within(screen.getByTestId("demo-Spinner")).getByRole("progressbar", { name: "Loading comments" })).toBeBusy();
	});
});
