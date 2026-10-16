import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";
import { z } from "zod";

import { AlertDialog, type AlertDialogProps } from "../alert-dialog";

function dialog(overrides: Partial<AlertDialogProps> = {}): React.JSX.Element {
	return (
		<AlertDialog
			visible
			title="Revoke this device?"
			description="It will be signed out at once."
			confirmLabel="Revoke"
			cancelLabel="Keep"
			onConfirm={jest.fn()}
			onCancel={jest.fn()}
			testID="alert"
			{...overrides}
		/>
	);
}

/** The Modal host element: the rendered tree's root (it carries `onRequestClose` and `animationType`). */
function modal(): NonNullable<typeof screen.root> {
	const { root } = screen;
	if (root === null) {
		throw new Error("Nothing is rendered.");
	}
	return root;
}

function classNameOf(testID: string): string {
	return z.string().parse(screen.getByTestId(testID).props.className);
}

describe("AlertDialog", () => {
	it("is an alert dialog that names the consequence", async () => {
		await render(dialog());

		expect(screen.getByTestId("alert")).toHaveProp("role", "alertdialog");
		expect(screen.getByRole("header", { name: "Revoke this device?" })).toBeOnTheScreen();
		expect(screen.getByText("It will be signed out at once.")).toBeOnTheScreen();
	});

	it("reports confirm and cancel, and cancels on the Android back button", async () => {
		const onConfirm = jest.fn();
		const onCancel = jest.fn();
		await render(dialog({ onConfirm, onCancel }));

		await fireEvent.press(screen.getByRole("button", { name: "Revoke" }));
		await fireEvent.press(screen.getByRole("button", { name: "Keep" }));
		await fireEvent(modal(), "requestClose");

		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(onCancel).toHaveBeenCalledTimes(2);
	});

	it("does not close from a tap on the scrim: the person must choose", async () => {
		const onCancel = jest.fn();
		await render(dialog({ onCancel }));

		await fireEvent.press(screen.getByTestId("alert-scrim", { includeHiddenElements: true }));

		expect(onCancel).not.toHaveBeenCalled();
	});

	it("while pending: spins on confirm, blocks cancel, ignores back", async () => {
		const onCancel = jest.fn();
		await render(dialog({ onCancel, pending: true }));

		expect(screen.getByRole("button", { name: "Revoke" })).toBeBusy();
		expect(screen.getByRole("button", { name: "Keep" })).toBeDisabled();
		await fireEvent(modal(), "requestClose");
		expect(onCancel).not.toHaveBeenCalled();
	});

	it("shows a failure in its error state, which pending outranks", async () => {
		const view = await render(dialog({ error: "Could not revoke the device." }));
		expect(screen.getByRole("alert")).toHaveTextContent("Could not revoke the device.");
		expect(classNameOf("alert")).toContain("border-destructive");

		await view.rerender(dialog({ error: "Could not revoke the device.", pending: true }));
		expect(classNameOf("alert")).not.toContain("border-destructive");
	});

	it("has a destructive variant, through `variant` or the `destructive` shorthand", async () => {
		const view = await render(dialog({ destructive: true }));
		expect(classNameOf("alert")).toContain("border-destructive");
		expect(screen.getByRole("button", { name: "Revoke" })).toHaveProp("className", expect.stringContaining("bg-destructive"));

		await view.rerender(dialog({ variant: "destructive" }));
		expect(screen.getByRole("button", { name: "Revoke" })).toHaveProp("className", expect.stringContaining("bg-destructive"));

		await view.rerender(dialog());
		expect(screen.getByRole("button", { name: "Revoke" })).toHaveProp("className", expect.stringContaining("bg-primary"));
	});

	it("renders nothing while hidden", async () => {
		await render(dialog({ visible: false }));
		expect(screen.queryByText("Revoke this device?")).toBeNull();
	});

	it("forwards its ref to the card", async () => {
		const ref = React.createRef<View>();
		await render(<AlertDialog ref={ref} visible title="T" description="D" confirmLabel="OK" cancelLabel="Cancel" onConfirm={jest.fn()} onCancel={jest.fn()} />);
		expect(ref.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(dialog({ className: "max-w-sm p-6", size: "lg" }));
		const className = classNameOf("alert");
		expect(className).toContain("max-w-sm");
		expect(className).not.toContain("max-w-lg");
		expect(className).toContain("p-6");
		expect(className).not.toContain("p-5");
	});
});
