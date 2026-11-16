import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo } from "react-native";

import { ToastStoreProvider } from "../../toast/facade";
import { createToastStore } from "../../toast/store";
import { ToastHost } from "../../toast/toast-host";
import { Sonner10Example } from "../examples/toast/sonner-10";
import { Sonner21Example } from "../examples/toast/sonner-21";
import { Sonner3Example } from "../examples/toast/sonner-3";
import { Sonner6Example } from "../examples/toast/sonner-6";
import { Sonner7Example } from "../examples/toast/sonner-7";
import { Sonner8Example } from "../examples/toast/sonner-8";

/** An example inside the app's toast store, with the host that shows its toasts. */
async function renderWithHost(example: React.JSX.Element): Promise<void> {
	await render(
		<ToastStoreProvider store={createToastStore()}>
			{example}
			<ToastHost top={100} bottom={40} />
		</ToastStoreProvider>,
	);
}

async function advance(ms: number): Promise<void> {
	await act(async (): Promise<void> => {
		jest.advanceTimersByTime(ms);
		await Promise.resolve();
	});
}

describe("the toast examples", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("shows a toast at the place its button names", async () => {
		await renderWithHost(<Sonner3Example />);
		await fireEvent.press(screen.getByRole("button", { name: "Bottom" }));
		expect(screen.getByText("Notification appears at the bottom.")).toBeOnTheScreen();
	});

	it("replaces an archived notice with its confirmation when Undo is pressed", async () => {
		await renderWithHost(<Sonner6Example />);
		await fireEvent.press(screen.getByRole("button", { name: "Toast with Action" }));
		await fireEvent.press(screen.getByRole("button", { name: "Undo" }));
		expect(screen.getByText("Action undone")).toBeOnTheScreen();
	});

	it("follows the deploy from loading to its outcome", async () => {
		await renderWithHost(<Sonner7Example />);
		await fireEvent.press(screen.getByRole("button", { name: "Deploy" }));
		expect(screen.getByText("Deploying to production…")).toBeOnTheScreen();
		await advance(2_000);
		expect(screen.getByText("Deployed to production successfully")).toBeOnTheScreen();
	});

	it("keeps a deletion prompt until Cancel closes it", async () => {
		await renderWithHost(<Sonner8Example />);
		await fireEvent.press(screen.getByRole("button", { name: "Confirm Action" }));
		await advance(60_000);
		expect(screen.getByTestId("app-toast")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByTestId("app-toast")).toBeNull();
	});

	it("fills the upload's progress in place, then completes", async () => {
		await renderWithHost(<Sonner10Example />);
		await fireEvent.press(screen.getByRole("button", { name: "Upload Toast" }));
		expect(screen.getByText("2.4 MB · Uploading… 0%")).toBeOnTheScreen();
		await advance(500);
		expect(screen.getByText("2.4 MB · Uploading… 12%")).toBeOnTheScreen();
		await advance(500 * 8);
		expect(screen.getByText("2.4 MB · Complete")).toBeOnTheScreen();
	});

	it("rewrites one toast through each stage of the upload", async () => {
		await renderWithHost(<Sonner21Example />);
		await fireEvent.press(screen.getByRole("button", { name: "Updatable Toast" }));
		expect(screen.getByText("Preparing upload…")).toBeOnTheScreen();
		await advance(1_000);
		expect(screen.getByText("Uploading files… 30%")).toBeOnTheScreen();
		await advance(2_000);
		expect(screen.getByText("Upload complete!")).toBeOnTheScreen();
	});
});
