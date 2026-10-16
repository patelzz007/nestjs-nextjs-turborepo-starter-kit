import { act, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { SKELETON_MOTION } from "@workspace/tokens";
import { AccessibilityInfo, Dimensions, type View } from "react-native";
import { getAnimatedStyle } from "react-native-reanimated";
import { z } from "zod";

import { sweepBandLeft, sweepBandWidth } from "../../lib/skeleton-sweep";
import { Skeleton, SkeletonGroup, SkeletonText } from "../skeleton";

/** One animation frame at 60 Hz, so a timing that ends exactly on a boundary has settled. */
const FRAME_MS = 16;
/** Probe the pass a tenth of the way in, where ease-in-out has barely started moving. */
const EASE_PROBE_DIVISOR = 10;

/** The band's animated style: its one transform is the horizontal offset. */
const BandStyleSchema = z.object({ transform: z.tuple([z.object({ translateX: z.number() })]) });

function bandOffset(band: ReturnType<typeof screen.getByTestId>): number {
	const {
		transform: [{ translateX }],
	} = BandStyleSchema.parse(getAnimatedStyle(band));
	return translateX;
}

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

	it("waits a beat, then fades in, so a fast load never flashes", async () => {
		jest.useFakeTimers();
		await render(
			<SkeletonGroup accessibilityLabel="Loading" testID="group">
				<Skeleton className="h-4 w-20" />
			</SkeletonGroup>,
		);

		expect(getAnimatedStyle(screen.getByTestId("group"))).toMatchObject({ opacity: 0 });
		await act((): void => {
			jest.advanceTimersByTime(SKELETON_MOTION.revealDelayMs + SKELETON_MOTION.revealMs + FRAME_MS);
		});

		expect(getAnimatedStyle(screen.getByTestId("group"))).toMatchObject({ opacity: 1 });
		jest.useRealTimers();
	});

	it("sweeps one band across the window, through every bone, then rests", async () => {
		jest.useFakeTimers();
		await render(
			<SkeletonGroup accessibilityLabel="Loading" testID="group">
				<Skeleton className="h-4 w-20" testID="bone" />
			</SkeletonGroup>,
		);
		const { width } = Dimensions.get("window");
		const band = (): ReturnType<typeof screen.getByTestId> => screen.getByTestId("bone-sweep", { includeHiddenElements: true });

		expect(getAnimatedStyle(band())).toMatchObject({ width: sweepBandWidth(width), transform: [{ translateX: sweepBandLeft(0, width) }] });

		const travelMs = SKELETON_MOTION.sweepCycleMs * SKELETON_MOTION.travelFraction;
		// Ease-in: a tenth of the way through the travel time, the band has covered less than a tenth of its journey.
		await act((): void => {
			jest.advanceTimersByTime(travelMs / EASE_PROBE_DIVISOR);
		});
		const journey = sweepBandLeft(1, width) - sweepBandLeft(0, width);
		expect(bandOffset(band()) - sweepBandLeft(0, width)).toBeLessThan(journey / EASE_PROBE_DIVISOR);

		// The pass ends off the right edge, and the band rests there for the rest of the cycle.
		await act((): void => {
			jest.advanceTimersByTime(travelMs - travelMs / EASE_PROBE_DIVISOR + FRAME_MS);
		});
		expect(bandOffset(band())).toBeCloseTo(sweepBandLeft(1, width), 0);
		await act((): void => {
			jest.advanceTimersByTime((SKELETON_MOTION.sweepCycleMs - travelMs) / 2);
		});
		expect(bandOffset(band())).toBeCloseTo(sweepBandLeft(1, width), 0);
		jest.useRealTimers();
	});

	it("draws no band while Reduce Motion is on", async () => {
		jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
		await render(
			<SkeletonGroup accessibilityLabel="Loading" testID="group">
				<Skeleton className="h-4 w-20" testID="bone" />
			</SkeletonGroup>,
		);

		// Let the Reduce Motion reading (a promise) land.
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});

		expect(screen.getByTestId("bone", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.queryByTestId("bone-sweep", { includeHiddenElements: true })).toBeNull();
	});
});

describe("Skeleton", () => {
	it("stays still outside a group (no sweep to share)", async () => {
		await render(<Skeleton className="h-4 w-20" testID="bone" />);

		expect(screen.getByTestId("bone")).toBeOnTheScreen();
		expect(screen.queryByTestId("bone-sweep")).toBeNull();
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

describe("refs and classes", () => {
	it("forwards the ref of every part", async () => {
		const group = React.createRef<View>();
		const block = React.createRef<View>();
		const line = React.createRef<View>();
		await render(
			<SkeletonGroup ref={group} accessibilityLabel="Loading">
				<Skeleton ref={block} className="size-14 rounded-full" />
				<SkeletonText ref={line} size="base" widthClassName="w-40" />
			</SkeletonGroup>,
		);

		expect(group.current).not.toBeNull();
		expect(block.current).not.toBeNull();
		expect(line.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(
			<SkeletonGroup accessibilityLabel="Loading" className="gap-2" testID="group">
				<Skeleton className="bg-card" testID="bone" />
				<SkeletonText size="sm" widthClassName="w-20" className="h-6" testID="line" />
			</SkeletonGroup>,
		);

		expect(String(screen.getByTestId("group").props.className)).toContain("gap-2");
		const bone = String(screen.getByTestId("bone").props.className).split(" ");
		expect(bone).toContain("bg-card");
		expect(bone).not.toContain("bg-muted");
		const line = String(screen.getByTestId("line").props.className).split(" ");
		expect(line).toContain("h-6");
		expect(line).not.toContain("h-5");
	});
});
