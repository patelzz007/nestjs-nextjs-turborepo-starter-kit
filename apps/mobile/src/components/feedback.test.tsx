import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { Badge } from "./badge";
import { Banner } from "./banner";
import { ConfirmDialog } from "./confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "./states";

describe("Banner", () => {
	it("announces errors as alerts and other tones as summaries", async () => {
		await render(<Banner tone="error" message="Something failed" />);
		expect(screen.getByRole("alert")).toHaveTextContent("Something failed");
	});

	it.each(["info", "success", "warning"] satisfies ("info" | "success" | "warning")[])("renders a %s notice without an alert role", async (tone) => {
		await render(<Banner tone={tone} message="Note" testID="banner" />);
		expect(screen.getByRole("summary")).toHaveTextContent("Note");
		expect(screen.queryByRole("alert")).toBeNull();
	});
});

describe("Badge", () => {
	it.each(["neutral", "success", "warning"] satisfies ("neutral" | "success" | "warning")[])("shows its label (%s)", async (tone) => {
		await render(<Badge label="This device" tone={tone} />);
		expect(screen.getByText("This device")).toBeOnTheScreen();
	});
});

describe("states", () => {
	it("announces loading with a label", async () => {
		await render(<LoadingState label="Loading your devices…" />);
		expect(screen.getByRole("progressbar", { name: "Loading your devices…" })).toBeOnTheScreen();
	});

	it("shows an empty message", async () => {
		await render(<EmptyState message="Nothing here" />);
		expect(screen.getByText("Nothing here")).toBeOnTheScreen();
	});

	it("shows an error with a retry", async () => {
		const onRetry = jest.fn();
		await render(<ErrorState message="Could not load" retryLabel="Try again" onRetry={onRetry} />);
		expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});
});

describe("ConfirmDialog", () => {
	function dialog(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}): React.JSX.Element {
		return (
			<ConfirmDialog
				visible
				title="Sign out?"
				description="You will need your password."
				confirmLabel="Sign out"
				cancelLabel="Cancel"
				onConfirm={jest.fn()}
				onCancel={jest.fn()}
				{...overrides}
			/>
		);
	}

	it("names the consequence and reports confirm and cancel", async () => {
		const onConfirm = jest.fn();
		const onCancel = jest.fn();
		await render(dialog({ onConfirm, onCancel, destructive: true }));

		expect(screen.getByText("You will need your password.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
		await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it("blocks both buttons while pending and shows a failure", async () => {
		await render(dialog({ pending: true, error: "Try again later" }));
		expect(screen.getByRole("button", { name: "Sign out" })).toBeBusy();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
		expect(screen.getByText("Try again later")).toBeOnTheScreen();
	});

	it("renders nothing while hidden", async () => {
		await render(dialog({ visible: false }));
		expect(screen.queryByText("Sign out?")).toBeNull();
	});
});
