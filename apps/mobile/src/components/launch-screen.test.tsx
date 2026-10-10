import { act, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";

import { LAUNCH_MARK_SIZE, LaunchScreen } from "./launch-screen";

describe("LaunchScreen", () => {
	it("shows the app's name and its line, announced as the app starting", async () => {
		await render(<LaunchScreen title="Starter" tagline="Your account, wherever you are." testID="launch" />);

		expect(screen.getByTestId("launch")).toHaveAccessibleName("Starter is starting");
		expect(screen.getByText("Starter", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByText("Your account, wherever you are.", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("starts as the native splash's still mark, then lifts it and brings the words up beneath", async () => {
		jest.useFakeTimers();
		await render(<LaunchScreen title="Starter" tagline="Your account, wherever you are." testID="launch" />);
		const mark = screen.getByTestId("launch-mark", { includeHiddenElements: true });
		expect(getAnimatedStyle(mark)).toMatchObject({ transform: [{ translateY: -0 }] });

		await act((): void => {
			jest.advanceTimersByTime(2000);
		});

		expect(getAnimatedStyle(mark)).toMatchObject({ transform: [{ translateY: -44 }] });
		jest.useRealTimers();
	});

	it("lands composed, without moving, when Reduce Motion is on", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		await render(<LaunchScreen title="Starter" tagline="Your account, wherever you are." testID="launch" />);
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});

		expect(getAnimatedStyle(screen.getByTestId("launch-mark", { includeHiddenElements: true }))).toMatchObject({ transform: [{ translateY: -44 }] });
	});

	it("draws the mark at the native splash's size, so the hand-off does not jump", () => {
		expect(LAUNCH_MARK_SIZE).toBe(96);
	});
});
