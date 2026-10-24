import { act, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";

import { PAGE_CHANGE_MS } from "../../lib/motion";
import { Progress, progressFractionOf, type ProgressVariant } from "../progress";

/** One animation frame at 60 Hz, so a timing that ends exactly on a boundary has settled. */
const FRAME_MS = 16;

const VARIANT_FILLS: readonly (readonly [ProgressVariant, string])[] = [
	["default", "bg-primary"],
	["success", "bg-success"],
	["warning", "bg-warning"],
	["destructive", "bg-destructive"],
];

function indicatorClassName(): string {
	return String(screen.getByTestId("bar-indicator").props.className);
}

describe("progressFractionOf", () => {
	it.each([
		[50, 100, 0.5],
		[3, 4, 0.75],
		[-5, 100, 0],
		[150, 100, 1],
		[1, 0, 0],
	])("%d of %d is %d", (value: number, max: number, fraction: number) => {
		expect(progressFractionOf(value, max)).toBe(fraction);
	});
});

describe("Progress", () => {
	it("is a progress bar named for what is progressing, with its value", async () => {
		await render(<Progress value={30} accessibilityLabel="Uploading photo" valueText="30 percent" />);

		const bar = screen.getByRole("progressbar", { name: "Uploading photo" });
		expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 30, text: "30 percent" });
	});

	it("clamps the announced value to its range", async () => {
		await render(<Progress value={7} max={5} accessibilityLabel="Steps" />);
		expect(screen.getByRole("progressbar", { name: "Steps" })).toHaveAccessibilityValue({ min: 0, max: 5, now: 5 });
	});

	it("fills to its value, and eases to a new one", async () => {
		jest.useFakeTimers();
		const view = await render(<Progress value={25} accessibilityLabel="Upload" testID="bar" />);
		expect(getAnimatedStyle(screen.getByTestId("bar-indicator"))).toMatchObject({ flexGrow: 0.25 });

		await view.rerender(<Progress value={75} accessibilityLabel="Upload" testID="bar" />);
		await act((): void => {
			jest.advanceTimersByTime(PAGE_CHANGE_MS + FRAME_MS);
		});
		expect(getAnimatedStyle(screen.getByTestId("bar-indicator"))).toMatchObject({ flexGrow: 0.75 });
		jest.useRealTimers();
	});

	it.each(VARIANT_FILLS)("fills the %s variant with %s", async (variant, fill) => {
		await render(<Progress value={10} variant={variant} accessibilityLabel="Upload" testID="bar" />);
		expect(indicatorClassName()).toContain(fill);
	});

	it.each([
		["sm", "h-1"],
		["md", "h-1.5"],
		["lg", "h-2.5"],
	] satisfies [React.ComponentProps<typeof Progress>["size"], string][])("has a %s track (%s)", async (size, height) => {
		await render(<Progress value={10} size={size} accessibilityLabel="Upload" />);
		expect(String(screen.getByRole("progressbar").props.className).split(" ")).toContain(height);
	});

	it("turns the fill destructive when invalid, unless it is disabled", async () => {
		const view = await render(<Progress value={40} accessibilityLabel="Upload" invalid testID="bar" />);
		expect(indicatorClassName()).toContain("bg-destructive");

		await view.rerender(<Progress value={40} accessibilityLabel="Upload" invalid disabled testID="bar" />);
		expect(indicatorClassName()).not.toContain("bg-destructive");
		const bar = screen.getByRole("progressbar", { name: "Upload" });
		expect(bar).toBeDisabled();
		expect(bar).toHaveProp("className", expect.stringContaining("opacity-60"));
	});

	it("is announced busy while loading", async () => {
		await render(<Progress value={40} accessibilityLabel="Upload" loading />);
		expect(screen.getByRole("progressbar", { name: "Upload" })).toBeBusy();
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Progress ref={ref} value={1} accessibilityLabel="Upload" />);
		expect(ref.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<Progress value={1} accessibilityLabel="Upload" className="bg-card" />);
		const className = String(screen.getByRole("progressbar").props.className);
		expect(className).toContain("bg-card");
		expect(className).not.toContain("bg-muted");
	});
});
