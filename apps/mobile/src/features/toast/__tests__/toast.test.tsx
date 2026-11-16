import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo, Pressable, Text } from "react-native";

import { TOAST_MOTION } from "@workspace/ui-native/lib/motion";
import { toastActions } from "../actions";
import { ToastStoreProvider, useToast } from "../facade";
import { toastReducer } from "../reducer";
import { INITIAL_TOAST_STATE } from "../state";
import { createToastStore } from "../store";
import { TOAST_DURATION_MS, ToastHost } from "../toast-host";

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
			<ToastHost top={100} bottom={40} />
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

describe("toastReducer updates", () => {
	it("rewrites the toast on show in place, and leaves a gone one gone", () => {
		const shown = toastReducer(INITIAL_TOAST_STATE, toastActions.shown("loading", "Deploying…", { durationMs: null }));
		const updated = toastReducer(shown, toastActions.updated(1, "success", "Deployed.", { title: "acme-web" }));
		expect(updated.current).toEqual({ id: 1, tone: "success", message: "Deployed.", options: { title: "acme-web", position: undefined } });
		expect(toastReducer(shown, toastActions.updated(9, "error", "Late."))).toBe(shown);
	});

	it("keeps a toast where it sits when the update names no position", () => {
		const shown = toastReducer(INITIAL_TOAST_STATE, toastActions.shown("info", "Archived.", { position: "bottom" }));
		expect(toastReducer(shown, toastActions.updated(1, "success", "Restored.")).current?.options?.position).toBe("bottom");
	});
});

/** Commands with options: a persistent bottom toast with a title and an action, an update and a promise. */
function RichHarness({ work }: { readonly work: Promise<string> }): React.JSX.Element {
	const toast = useToast();
	const [last, setLast] = React.useState<number | null>(null);
	const keep = React.useCallback((): void => {
		setLast(toast.info("Archived 3 files.", { title: "Archive", position: "bottom", durationMs: null, actions: <Text>Undo</Text> }));
	}, [toast]);
	const rewrite = React.useCallback((): void => {
		if (last !== null) {
			toast.update(last, "success", "Restored.");
		}
	}, [last, toast]);
	const run = React.useCallback((): void => {
		toast.promise(work, { loading: "Deploying…", success: (name: string): string => `Deployed ${name}.`, error: "The deploy failed." }).catch((): void => {
			// The failure is shown by the toast.
		});
	}, [toast, work]);
	return (
		<>
			<Pressable accessibilityRole="button" accessibilityLabel="Keep" onPress={keep}>
				<Text>Keep</Text>
			</Pressable>
			<Pressable accessibilityRole="button" accessibilityLabel="Rewrite" onPress={rewrite}>
				<Text>Rewrite</Text>
			</Pressable>
			<Pressable accessibilityRole="button" accessibilityLabel="Run" onPress={run}>
				<Text>Run</Text>
			</Pressable>
			<ToastHost top={100} bottom={40} />
		</>
	);
}

describe("ToastHost options", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("keeps a persistent bottom toast with its title and actions, and rewrites it in place", async () => {
		const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation((): void => undefined);
		await render(
			<ToastStoreProvider store={createToastStore()}>
				<RichHarness work={Promise.resolve("acme")} />
			</ToastStoreProvider>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Keep" }));
		expect(screen.getByText("Archive")).toBeOnTheScreen();
		expect(screen.getByText("Undo")).toBeOnTheScreen();
		expect(announce).toHaveBeenCalledWith("Archive. Archived 3 files.");
		await advance(TOAST_DURATION_MS.error * 2);
		expect(screen.getByText("Archived 3 files.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Rewrite" }));
		expect(screen.getByText("Restored.")).toBeOnTheScreen();
		expect(screen.queryByText("Archived 3 files.")).toBeNull();
	});

	it("shows a loading toast that turns into the work's outcome", async () => {
		await render(
			<ToastStoreProvider store={createToastStore()}>
				<RichHarness work={Promise.resolve("acme")} />
			</ToastStoreProvider>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Run" }));
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		expect(screen.getByText("Deployed acme.")).toBeOnTheScreen();
		await render(
			<ToastStoreProvider store={createToastStore()}>
				<RichHarness work={Promise.reject(new Error("boom"))} />
			</ToastStoreProvider>,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Run" }));
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		expect(screen.getByText("The deploy failed.")).toBeOnTheScreen();
	});
});
