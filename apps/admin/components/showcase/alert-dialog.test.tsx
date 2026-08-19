// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
	AlertDialogTrigger,
	confirmDialogLabels,
	type AlertDialogLabels,
} from "@workspace/ui/components/overlay/alert-dialog";
import { SHOWCASE_ALERT_DIALOG_LABELS } from "@workspace/ui/lib/alert-dialog-labels";

/** jsdom has no ResizeObserver; base-ui tolerates its absence, stub to be safe. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

/** Controlled harness so tests can assert open/close + confirm wiring. */
function ControlledHarness({
	onConfirm,
	requireConfirmation,
	requireReason,
	delaySeconds,
	confirmLoading,
	severity,
	labels = SHOWCASE_ALERT_DIALOG_LABELS,
}: {
	readonly onConfirm?: () => void;
	readonly requireConfirmation?: string;
	readonly requireReason?: boolean;
	readonly delaySeconds?: number;
	readonly confirmLoading?: boolean;
	readonly severity?: "info" | "warning" | "critical";
	readonly labels?: AlertDialogLabels;
}): React.JSX.Element {
	const [open, setOpen] = useState<boolean>(false);
	const [confirmationValue, setConfirmationValue] = useState<string>("");
	const [reasonValue, setReasonValue] = useState<string>("");
	const handleOpenChange = useCallback((next: boolean): void => {
		setOpen(next);
	}, []);

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogTrigger render={<button type="button">Open dialog</button>} />
			<AlertDialogContent
				severity={severity ?? "info"}
				labels={labels}
				requireConfirmation={requireConfirmation}
				confirmationValue={confirmationValue}
				onConfirmationValueChange={setConfirmationValue}
				requireReason={requireReason}
				reasonValue={reasonValue}
				onReasonValueChange={setReasonValue}
				delaySeconds={delaySeconds}
				confirmLoading={confirmLoading}
				onConfirm={onConfirm}>
				<AlertDialogTitle>Are you sure?</AlertDialogTitle>
				<AlertDialogDescription>This action is permanent.</AlertDialogDescription>
			</AlertDialogContent>
		</AlertDialog>
	);
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("AlertDialog", () => {
	it("opens on trigger click and renders title + description (improvement 5 wiring)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(<ControlledHarness />);
		fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
		expect(screen.getByText("Are you sure?")).toBeTruthy();
		expect(screen.getByText("This action is permanent.")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
		expect(screen.getByRole("button", { name: /Confirm/ })).toBeTruthy();
	});

	it("cancel closes the dialog (improvement 11 focus return path)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(<ControlledHarness />);
		fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByText("Are you sure?")).toBeNull();
	});

	it("fires onConfirm when the confirm action is pressed (feature 16)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		const onConfirm = vi.fn();
		render(<ControlledHarness onConfirm={onConfirm} />);
		fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
		fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it("disables confirm until the keyword is typed (feature 3)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(<ControlledHarness requireConfirmation="delete" />);
		fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
		const confirm = screen.getByRole("button", { name: /Confirm/ });
		expect(confirm.getAttribute("disabled")).not.toBeNull();
		fireEvent.change(screen.getByRole("textbox"), { target: { value: "delete" } });
		expect(screen.getByRole("button", { name: /Confirm/ }).getAttribute("disabled")).toBeNull();
	});

	it("disables confirm until a reason is typed (feature 9)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(<ControlledHarness requireReason />);
		fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
		const confirm = screen.getByRole("button", { name: /Confirm/ });
		expect(confirm.getAttribute("disabled")).not.toBeNull();
		fireEvent.change(screen.getByPlaceholderText(SHOWCASE_ALERT_DIALOG_LABELS.reasonPlaceholder), { target: { value: "because" } });
		expect(screen.getByRole("button", { name: /Confirm/ }).getAttribute("disabled")).toBeNull();
	});

	it("gates confirm behind a countdown (feature 4)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		vi.useFakeTimers();
		render(<ControlledHarness delaySeconds={3} />);
		act(() => {
			fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
		});
		expect(screen.getByRole("button", { name: /Confirm/ }).getAttribute("disabled")).not.toBeNull();
		act(() => {
			vi.advanceTimersByTime(3200);
		});
		expect(screen.getByRole("button", { name: /Confirm/ }).getAttribute("disabled")).toBeNull();
	});

	it("renders a summary table when provided (feature 10)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<AlertDialog>
				<AlertDialogTrigger render={<button type="button">Open</button>} />
				<AlertDialogContent
					severity="critical"
					labels={{ ...SHOWCASE_ALERT_DIALOG_LABELS, confirm: "Delete" }}
					summary={[
						{ label: "Users", value: "12" },
						{ label: "Sessions", value: "34" },
					]}>
					<AlertDialogTitle>Delete users?</AlertDialogTitle>
				</AlertDialogContent>
			</AlertDialog>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Open" }));
		expect(screen.getByRole("table")).toBeTruthy();
		expect(screen.getByText("Sessions")).toBeTruthy();
	});

	it("renders the undo hint (feature 11)", () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(
			<AlertDialog>
				<AlertDialogTrigger render={<button type="button">Open</button>} />
				<AlertDialogContent severity="critical" labels={{ ...SHOWCASE_ALERT_DIALOG_LABELS, confirm: "Delete" }} undoHint="You can undo for 5 seconds.">
					<AlertDialogTitle>Delete?</AlertDialogTitle>
				</AlertDialogContent>
			</AlertDialog>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Open" }));
		expect(screen.getByText("You can undo for 5 seconds.")).toBeTruthy();
	});

	it("shows a loading spinner on the confirm button (feature 2)", async () => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		render(<ControlledHarness confirmLoading />);
		fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
		await waitFor(() => {
			expect(screen.getByRole("button", { name: /Working/ })).toBeTruthy();
		});
	});

	it("confirmDialogLabels returns the provided label bundle (feature 20)", () => {
		expect(confirmDialogLabels(SHOWCASE_ALERT_DIALOG_LABELS)).toEqual(SHOWCASE_ALERT_DIALOG_LABELS);
	});
});
