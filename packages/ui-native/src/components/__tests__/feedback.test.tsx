// AlertDialog's behaviour (the component is owned by the overlays batch, which may move this into
// its own alert-dialog.test.tsx). Alert, Badge and the screen states each have their own test file.

import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { AlertDialog } from "../alert-dialog";

describe("AlertDialog", () => {
	function dialog(overrides: Partial<React.ComponentProps<typeof AlertDialog>> = {}): React.JSX.Element {
		return (
			<AlertDialog
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
