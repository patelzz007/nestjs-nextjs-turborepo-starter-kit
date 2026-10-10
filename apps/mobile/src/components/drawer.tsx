// A drawer: a panel that slides over the app from the left edge, above a
// dimmed scrim (ADR 038). Presentational and controlled — the caller owns
// `open` and says what opening and closing do. It closes from the scrim, the
// Android back button, the screen reader's escape gesture and a leftward drag;
// with `swipeEnabled`, a rightward drag from the left edge opens it. Motion runs
// on the UI thread (Reanimated) and follows the OS "Reduce Motion" setting.

import * as React from "react";
import { BackHandler, PanResponder, Pressable, useWindowDimensions, View, type GestureResponderEvent, type PanResponderGestureState } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { PANEL_SPRING } from "../lib/motion";
import { isHorizontalDrag, progressWhileClosing, progressWhileOpening, settlesOpen } from "./drawer-gesture";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

const CLOSED = 0;
const OPEN = 1;
/** The panel covers most of a phone, never all of it: the scrim beside it stays visible to tap. */
const PANEL_SCREEN_SHARE = 0.84;
/** On wide screens the panel stops growing. */
const PANEL_MAX_WIDTH = 340;
/** Extra travel when closed so the panel's shadow leaves the screen too. */
const SHADOW_CLEARANCE = 32;
/** An interrupted drag has no release speed. */
const NO_VELOCITY = 0;
/** How dark the scrim gets with the drawer fully open. */
const SCRIM_MAX_OPACITY = 0.45;

export interface DrawerProps {
	readonly open: boolean;
	readonly onOpen: () => void;
	readonly onClose: () => void;
	/** The panel's content. */
	readonly panel: React.ReactNode;
	/** What the drawer is, for screen readers ("Menu"). */
	readonly accessibilityLabel: string;
	/** The scrim's name for screen readers ("Close menu"). */
	readonly closeLabel: string;
	/** Whether a drag from the left edge opens the drawer (off where the edge swipe means "back"). */
	readonly swipeEnabled?: boolean;
	/** The app underneath. */
	readonly children: React.ReactNode;
	readonly testID?: string;
}

export function Drawer({ open, onOpen, onClose, panel, accessibilityLabel, closeLabel, swipeEnabled = true, children, testID }: DrawerProps): React.JSX.Element {
	const { width: screenWidth } = useWindowDimensions();
	const insets = useSafeAreaInsets();
	const panelWidth = Math.min(screenWidth * PANEL_SCREEN_SHARE, PANEL_MAX_WIDTH);
	const progress = useSharedValue(open ? OPEN : CLOSED);

	React.useEffect((): void => {
		progress.set(withSpring(open ? OPEN : CLOSED, PANEL_SPRING));
	}, [open, progress]);

	// The Android back button closes an open drawer before it does anything else.
	React.useEffect((): (() => void) | undefined => {
		if (!open) {
			return undefined;
		}
		const subscription = BackHandler.addEventListener("hardwareBackPress", (): boolean => {
			onClose();
			return true;
		});
		return (): void => {
			subscription.remove();
		};
	}, [onClose, open]);

	/** A released drag: settle where the gesture says, and tell the caller if that changes the state. */
	const settle = React.useCallback(
		(releasedProgress: number, velocityX: number): void => {
			const shouldBeOpen = settlesOpen(releasedProgress, velocityX);
			progress.set(withSpring(shouldBeOpen ? OPEN : CLOSED, PANEL_SPRING));
			if (shouldBeOpen && !open) {
				onOpen();
			} else if (!shouldBeOpen && open) {
				onClose();
			}
		},
		[onClose, onOpen, open, progress],
	);

	const edgeResponder = React.useMemo(
		() =>
			PanResponder.create({
				onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture: PanResponderGestureState): boolean => isHorizontalDrag(gesture.dx, gesture.dy, 1),
				onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
					progress.set(progressWhileOpening(gesture.dx, panelWidth));
				},
				onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
					settle(progressWhileOpening(gesture.dx, panelWidth), gesture.vx);
				},
				onPanResponderTerminate: (): void => {
					settle(CLOSED, NO_VELOCITY);
				},
			}),
		[panelWidth, progress, settle],
	);

	const panelResponder = React.useMemo(
		() =>
			PanResponder.create({
				onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture: PanResponderGestureState): boolean => isHorizontalDrag(gesture.dx, gesture.dy, -1),
				onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
					progress.set(progressWhileClosing(gesture.dx, panelWidth));
				},
				onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
					settle(progressWhileClosing(gesture.dx, panelWidth), gesture.vx);
				},
				onPanResponderTerminate: (): void => {
					settle(OPEN, NO_VELOCITY);
				},
			}),
		[panelWidth, progress, settle],
	);

	const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() * SCRIM_MAX_OPACITY }));
	const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.get() - OPEN) * (panelWidth + SHADOW_CLEARANCE) }] }));
	const panelFrame = React.useMemo(
		(): { readonly width: number; readonly paddingTop: number; readonly paddingBottom: number } => ({
			width: panelWidth,
			paddingTop: insets.top,
			paddingBottom: insets.bottom,
		}),
		[insets.bottom, insets.top, panelWidth],
	);

	return (
		<View className="flex-1" testID={testID}>
			{/* While the drawer is open, screen readers see only the drawer. */}
			<View className="flex-1" accessibilityElementsHidden={open} importantForAccessibility={open ? "no-hide-descendants" : "auto"}>
				{children}
			</View>
			{swipeEnabled && !open ? (
				<View className="absolute inset-y-0 left-0 w-5" {...edgeResponder.panHandlers} testID={testID === undefined ? undefined : `${testID}-edge`} />
			) : null}
			<StyledAnimatedView pointerEvents={open ? "auto" : "none"} className="absolute inset-0 bg-scrim" style={scrimStyle}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={closeLabel}
					onPress={onClose}
					className="flex-1"
					testID={testID === undefined ? undefined : `${testID}-scrim`}
				/>
			</StyledAnimatedView>
			<StyledAnimatedView
				accessibilityLabel={accessibilityLabel}
				accessibilityViewIsModal={open}
				accessibilityElementsHidden={!open}
				importantForAccessibility={open ? "yes" : "no-hide-descendants"}
				pointerEvents={open ? "auto" : "none"}
				className="absolute inset-y-0 left-0 overflow-hidden rounded-r-3xl border-r border-border bg-card shadow-2xl"
				style={[panelFrame, panelStyle]}
				{...panelResponder.panHandlers}
				testID={testID === undefined ? undefined : `${testID}-panel`}>
				{/* The screen reader's escape gesture reaches the nearest handler up from the focused element. */}
				<View className="flex-1" onAccessibilityEscape={onClose} testID={testID === undefined ? undefined : `${testID}-content`}>
					{panel}
				</View>
			</StyledAnimatedView>
		</View>
	);
}
