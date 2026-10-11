import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo, Pressable, Text } from "react-native";

import { TOAST_MOTION } from "../../lib/motion";
import { toastActions } from "./actions";
import { ToastStoreProvider, useToast } from "./facade";
import { toastReducer } from "./reducer";
import { INITIAL_TOAST_STATE } from "./state";
import { createToastStore } from "./store";
import { TOAST_DURATION_MS, ToastHost } from "./toast-host";

describe("toastReducer", () => {
	it("shows a toast with the next id, replacing the one on show", () => {
		const first = toastReducer(INITIAL_TOAST_STATE, toastActions.shown("success", "Saved."));
		const second = toastReducer(first, toastActions.shown("error", "Failed."));

		expect(first.current).toEqual({ id: 1, tone: "success", message: "Saved." });
		expect(second.current).toEqual({ id: 2, tone: "error", message: "Failed." });
	});

	it("dismisses only the toast it names — a late timer never removes a newer one", () => {
		const shown = toastReducer(toastReducer(INITIAL_TOAST_STATE, toastActions.shown("success", "Old.")), toastActions.shown("success", "New."));

		expect(toastReducer(shown, toastActions.dismissed(1))).toBe(shown);
		expect(toastReducer(shown, toastActions.dismissed(2)).current).toBeNull();
	});
});

/** Buttons that show toasts, beside the host, in one store. */
function Harness(): React.JSX.Element {
	const toast = useToast();
	const save = React.useCallback((): void => {
		toast.success("Profile saved.");
	}, [toast]);
	const fail = React.useCallback((): void => {
		toast.error("Something went wrong.");
	}, [toast]);
	return (
		<>
			<Pressable accessibilityRole="button" accessibilityLabel="Save" onPress={save}>
				<Text>Save</Text>
			</Pressable>
			<Pressable accessibilityRole="button" accessibilityLabel="Fail" onPress={fail}>
				<Text>Fail</Text>
			</Pressable>
			<ToastHost top={100} />
		</>
	);
}

async function renderHarness(): Promise<void> {
	await render(
		<ToastStoreProvider store={createToastStore()}>
			<Harness />
		</ToastStoreProvider>,
	);
}

/** Moves the fake clock in a synchronous act (the toast's timers and its animation frames). */
async function advance(ms: number): Promise<void> {
	await act((): void => {
		jest.advanceTimersByTime(ms);
	});
}

describe("ToastHost", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("shows a success, announces it, and slides it away after its time", async () => {
		const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
		await renderHarness();

		await fireEvent.press(screen.getByRole("button", { name: "Save" }));

		expect(within(screen.getByTestId("app-toast")).getByText("Profile saved.")).toBeOnTheScreen();
		expect(announce).toHaveBeenCalledWith("Profile saved.");
		await advance(TOAST_DURATION_MS.success - 1);
		expect(screen.getByTestId("app-toast")).toBeOnTheScreen();

		await advance(1);
		// Leaving: still there while it slides out, gone once the exit has run.
		expect(screen.getByTestId("app-toast-leaving")).toBeOnTheScreen();
		await advance(TOAST_MOTION.exit.duration);
		expect(screen.queryByText("Profile saved.")).toBeNull();
	});

	it("keeps an error longer", async () => {
		await renderHarness();

		await fireEvent.press(screen.getByRole("button", { name: "Fail" }));
		await advance(TOAST_DURATION_MS.success);

		expect(within(screen.getByTestId("app-toast")).getByText("Something went wrong.")).toBeOnTheScreen();
		await advance(TOAST_DURATION_MS.error - TOAST_DURATION_MS.success + TOAST_MOTION.exit.duration);
		expect(screen.queryByText("Something went wrong.")).toBeNull();
	});

	it("dismisses from its close button: it slides out at once", async () => {
		await renderHarness();
		await fireEvent.press(screen.getByRole("button", { name: "Save" }));

		await fireEvent.press(screen.getByRole("button", { name: "Dismiss" }));

		expect(screen.getByTestId("app-toast-leaving")).toBeOnTheScreen();
		await advance(TOAST_MOTION.exit.duration);
		expect(screen.queryByText("Profile saved.")).toBeNull();
	});

	it("slides a replacing toast in while the old one slides out, and gives it its full time", async () => {
		await renderHarness();
		await fireEvent.press(screen.getByRole("button", { name: "Save" }));
		await advance(TOAST_DURATION_MS.success - 1);

		await fireEvent.press(screen.getByRole("button", { name: "Fail" }));

		expect(within(screen.getByTestId("app-toast-leaving")).getByText("Profile saved.")).toBeOnTheScreen();
		expect(within(screen.getByTestId("app-toast")).getByText("Something went wrong.")).toBeOnTheScreen();
		await advance(TOAST_DURATION_MS.error - 1);
		expect(screen.queryByText("Profile saved.")).toBeNull();
		expect(within(screen.getByTestId("app-toast")).getByText("Something went wrong.")).toBeOnTheScreen();
	});
});
