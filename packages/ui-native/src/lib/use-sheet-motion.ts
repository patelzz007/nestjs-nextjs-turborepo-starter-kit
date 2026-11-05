// A bottom sheet's motion (BottomSheet, the date range picker): the backdrop fades and the sheet
// slides by its own height, both read from one presence value (lib/use-overlay-presence), so they
// arrive and leave together, and the Modal stays up until both are fully away.

import * as React from "react";
import { type LayoutChangeEvent, useWindowDimensions, type ViewStyle } from "react-native";
import { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import { SHEET_MOTION } from "./motion";
import { OVERLAY_SHOWN, useOverlayPresence } from "./use-overlay-presence";

/** How dark the backdrop gets with the sheet fully up. */
export const SHEET_SCRIM_OPACITY = 0.5;

/** A view's animated style, as `useAnimatedStyle` returns it for a view. */
type AnimatedViewStyle = ReturnType<typeof useAnimatedStyle<ViewStyle>>;

export interface SheetMotion {
	/** Keep the Modal up (its `visible`): shown, or still leaving. */
	readonly presented: boolean;
	/** Which opening this is: key the sheet's content on it so each opening starts fresh. */
	readonly opening: number;
	readonly backdropStyle: AnimatedViewStyle;
	readonly sheetStyle: AnimatedViewStyle;
	/** The sheet's `onLayout`: it slides by its own height, not the whole window's. */
	readonly measureSheet: (event: LayoutChangeEvent) => void;
}

export function useSheetMotion(visible: boolean): SheetMotion {
	const { presented, opening, progress } = useOverlayPresence(visible, SHEET_MOTION);
	// The window's height until the sheet has been measured, so it always starts off screen.
	const { height: windowHeight } = useWindowDimensions();
	const sheetHeight = useSharedValue(windowHeight);
	const measureSheet = React.useCallback(
		(event: LayoutChangeEvent): void => {
			sheetHeight.set(event.nativeEvent.layout.height);
		},
		[sheetHeight],
	);
	const backdropStyle = useAnimatedStyle<ViewStyle>(() => ({ opacity: progress.get() * SHEET_SCRIM_OPACITY }));
	const sheetStyle = useAnimatedStyle<ViewStyle>(() => ({ transform: [{ translateY: (OVERLAY_SHOWN - progress.get()) * sheetHeight.get() }] }));
	return { presented, opening, backdropStyle, sheetStyle, measureSheet };
}
