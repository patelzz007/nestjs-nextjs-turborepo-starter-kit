import { act, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";

import { PULSE } from "../lib/motion";
import { Skeleton, SkeletonGroup, SkeletonText } from "./skeleton";

describe("SkeletonGroup", () => {
	it("tells screen readers what is loading, as a busy progress bar", async () => {
		await render(
			<SkeletonGroup accessibilityLabel="Loading your account" testID="group">
				<Skeleton className="size-14 rounded-full" />
			</SkeletonGroup>,
		);

		const group = screen.getByRole("progressbar", { name: "Loading your account" });
		expect(group).toBeBusy();
	});

	it("is hidden from screen readers without a label (another group already says it)", async () => {
		await render(
			<SkeletonGroup testID="group">
				<Skeleton className="h-12 w-full rounded-xl" />
			</SkeletonGroup>,
		);

		expect(screen.queryByRole("progressbar")).toBeNull();
		expect(screen.getByTestId("group", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("breathes like the web's animate-pulse", async () => {
		jest.useFakeTimers();
		await render(
			<SkeletonGroup accessibilityLabel="Loading" testID="group">
				<Skeleton className="h-4 w-20" />
			</SkeletonGroup>,
		);

		await act((): void => {
			jest.advanceTimersByTime(PULSE.cycleMs / 2);
		});

		expect(getAnimatedStyle(screen.getByTestId("group"))).toMatchObject({ opacity: PULSE.minOpacity });
		jest.useRealTimers();
	});

	it("stays still while Reduce Motion is on", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		jest.useFakeTimers();
		await render(
			<SkeletonGroup accessibilityLabel="Loading" testID="group">
				<Skeleton className="h-4 w-20" />
			</SkeletonGroup>,
		);

		await act(async (): Promise<void> => {
			await Promise.resolve();
			jest.advanceTimersByTime(PULSE.cycleMs / 2);
		});

		expect(getAnimatedStyle(screen.getByTestId("group"))).toMatchObject({ opacity: 1 });
		jest.useRealTimers();
	});
});

describe("SkeletonText", () => {
	it.each([
		["sm", "h-5"],
		["base", "h-6"],
		["lg", "h-7"],
		["2xl", "h-8"],
	] satisfies [React.ComponentProps<typeof SkeletonText>["size"], string][])(
		"takes exactly a %s line's height (%s), so the text replaces it without moving",
		async (size, lineClass) => {
			await render(<SkeletonText size={size} widthClassName="w-40" testID="line" />);

			expect(screen.getByTestId("line").props.className).toContain(lineClass);
		},
	);
});
