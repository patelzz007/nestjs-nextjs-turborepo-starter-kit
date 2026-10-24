import { act, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { AccessibilityInfo, type ViewInstance } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";

import { PULSE } from "../../lib/motion";
import { PulseDot, type PulseDotTone } from "../pulse-dot";

const TONE_FILLS: readonly (readonly [PulseDotTone, string])[] = [
	["success", "bg-success"],
	["warning", "bg-warning"],
	["destructive", "bg-destructive"],
	["info", "bg-info"],
	["primary", "bg-primary"],
	["neutral", "bg-muted-foreground"],
];

function dot(): ReturnType<typeof screen.getByTestId> {
	return screen.getByTestId("dot", { includeHiddenElements: true });
}

describe("PulseDot", () => {
	it("is decorative: hidden from screen readers", async () => {
		await render(<PulseDot testID="dot" />);

		expect(screen.queryByTestId("dot")).toBeNull();
		expect(dot()).toBeOnTheScreen();
	});

	it("breathes to half opacity at the middle of its cycle", async () => {
		jest.useFakeTimers();
		await render(<PulseDot testID="dot" />);
		await act((): void => {
			jest.advanceTimersByTime(PULSE.cycleMs / 2);
		});

		expect(getAnimatedStyle(dot())).toMatchObject({ opacity: PULSE.minOpacity });
		jest.useRealTimers();
	});

	it("stays still while Reduce Motion is on", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		jest.useFakeTimers();
		await render(<PulseDot testID="dot" />);
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		await act((): void => {
			jest.advanceTimersByTime(PULSE.cycleMs / 2);
		});

		expect(getAnimatedStyle(dot())).toMatchObject({ opacity: 1 });
		jest.useRealTimers();
	});

	it.each(TONE_FILLS)("fills the %s tone with %s", async (tone, fill) => {
		await render(<PulseDot tone={tone} testID="dot" />);
		expect(String(dot().props.className)).toContain(fill);
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<PulseDot ref={ref} />);
		expect(ref.current).not.toBeNull();
	});

	it("lets the caller's className win over its size and tone", async () => {
		await render(<PulseDot size="sm" className="size-4 bg-auth-panel-foreground" testID="dot" />);
		const classes = String(dot().props.className).split(" ");
		expect(classes).toContain("size-4");
		expect(classes).toContain("bg-auth-panel-foreground");
		expect(classes).not.toContain("size-2");
		expect(classes).not.toContain("bg-success");
	});
});
