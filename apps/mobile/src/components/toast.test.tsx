import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { getAnimatedStyle } from "react-native-reanimated";
import { z } from "zod";

import { TOAST_MOTION } from "../lib/motion";
import { Toast, type ToastProps } from "./toast";

const DURATION_MS = 3_000;

function toast(overrides: Partial<ToastProps> = {}): React.JSX.Element {
	return (
		<Toast
			tone="success"
			message="Profile saved."
			durationMs={DURATION_MS}
			offscreenOffset={100}
			leaving={false}
			onDismiss={jest.fn()}
			onLeft={jest.fn()}
			testID="toast"
			{...overrides}
		/>
	);
}

/** The Uniwind classes an element was given (Jest renders them unstyled, so they are read as props). */
function classNameOf(testID: string): string {
	return z.string().parse(screen.getByTestId(testID).props.className);
}

/** Moves the fake clock in a synchronous act (the animations run on mocked frames). */
async function advance(ms: number): Promise<void> {
	await act((): void => {
		jest.advanceTimersByTime(ms);
	});
}

describe("Toast", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it.each([
		["success", "border-tone-green/30 bg-tone-green-soft", "bg-tone-green/55"],
		["info", "border-tone-blue/30 bg-tone-blue-soft", "bg-tone-blue/55"],
		["warning", "border-tone-yellow/30 bg-tone-yellow-soft", "bg-tone-yellow/55"],
		["error", "border-tone-red/30 bg-tone-red-soft", "bg-tone-red/55"],
	] satisfies [ToastProps["tone"], string, string][])("draws a %s toast like the web: tone-soft card, tone border, tone countdown", async (tone, card, countdown) => {
		await render(toast({ tone }));

		expect(classNameOf("toast")).toContain(card);
		expect(classNameOf("toast-countdown")).toContain(countdown);
	});

	it("slides in from above the screen on the web's curve, and starts draining its countdown", async () => {
		await render(toast());
		const card = screen.getByTestId("toast");
		expect(getAnimatedStyle(card)).toMatchObject({ opacity: 0 });

		await advance(TOAST_MOTION.enter.duration);

		expect(getAnimatedStyle(card)).toMatchObject({ opacity: 1, transform: [{ translateY: 0 }] });
		await advance(DURATION_MS);
		expect(getAnimatedStyle(screen.getByTestId("toast-countdown"))).toMatchObject({ transform: [{ scaleX: 0 }] });
	});

	it("asks to dismiss from its close button", async () => {
		const onDismiss = jest.fn();
		await render(toast({ onDismiss }));

		await fireEvent.press(screen.getByRole("button", { name: "Dismiss" }));

		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it("slides out when leaving, and only then reports it has left", async () => {
		const onLeft = jest.fn();
		const view = await render(toast({ onLeft }));
		await advance(TOAST_MOTION.enter.duration);

		await view.rerender(toast({ onLeft, leaving: true }));
		await advance(TOAST_MOTION.exit.duration - 1);
		expect(onLeft).not.toHaveBeenCalled();

		await advance(TOAST_MOTION.exit.duration);
		expect(onLeft).toHaveBeenCalledTimes(1);
		expect(getAnimatedStyle(screen.getByTestId("toast"))).toMatchObject({ opacity: 0 });
	});

	it("reads its message, and announces an error as an assertive alert", async () => {
		await render(toast({ tone: "error", message: "The check didn't pass." }));

		expect(screen.getByText("The check didn't pass.")).toBeOnTheScreen();
		// The card is not grouped into one element (its close button stays reachable), so the role sits on it as a prop.
		expect(screen.getByTestId("toast")).toHaveProp("accessibilityRole", "alert");
		expect(screen.getByTestId("toast")).toHaveProp("accessibilityLiveRegion", "assertive");
	});
});
