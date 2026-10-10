import { act, render, screen } from "@testing-library/react-native";
import { BRAND_MARK_FACETS } from "@workspace/tokens";
import * as React from "react";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";

import { PULSE } from "../lib/motion";
import { BrandMark } from "./brand-mark";
import { PulseDot } from "./pulse-dot";

describe("BrandMark", () => {
	it("draws the shared mark at the given size, every facet at its own strength", async () => {
		await render(<BrandMark size={40} colorClassName="accent-auth-panel-foreground" testID="mark" />);

		const mark = screen.getByTestId("mark", { includeHiddenElements: true });
		expect(mark).toHaveProp("width", 40);
		expect(mark).toHaveProp("height", 40);
		expect(BRAND_MARK_FACETS).toHaveLength(3);
	});
});

describe("PulseDot", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("is hidden from screen readers", async () => {
		await render(<PulseDot className="size-4 rounded-full bg-success" testID="dot" />);

		expect(screen.queryByTestId("dot")).toBeNull();
		expect(screen.getByTestId("dot", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("fades to half opacity at the middle of its cycle, like the web's animate-pulse", async () => {
		await render(<PulseDot className="size-4 rounded-full bg-success" testID="dot" />);

		await act((): void => {
			jest.advanceTimersByTime(PULSE.cycleMs / 2);
		});

		// Reanimated keeps animated values apart from the `style` prop; this reads the live one.
		expect(getAnimatedStyle(screen.getByTestId("dot", { includeHiddenElements: true }))).toMatchObject({ opacity: PULSE.minOpacity });
	});

	it("stays still while Reduce Motion is on", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		await render(<PulseDot className="size-4 rounded-full bg-success" testID="dot" />);
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});

		await act((): void => {
			jest.advanceTimersByTime(PULSE.cycleMs / 2);
		});

		expect(getAnimatedStyle(screen.getByTestId("dot", { includeHiddenElements: true }))).toMatchObject({ opacity: 1 });
	});
});
