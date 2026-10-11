// A drawer: a panel that slides over the app from the left edge, above a
// blurred, dimmed scrim (ADR 038). Presentational and controlled — the caller owns
// `open` and says what opening and closing do. It closes from the scrim, the
// Android back button, the screen reader's escape gesture and a leftward drag;
// with `swipeEnabled`, a rightward drag from the left edge opens it. Motion runs
// on the UI thread (Reanimated) and follows the OS "Reduce Motion" setting.
//
// The blur (expo-blur, `DrawerBlur`) follows the same progress as the dim and
// the panel. It is mounted only while the drawer is open, opening or closing —
// a closed drawer keeps no blur view rendering behind the app. On Android the
// blur reads the app through a BlurTargetView around it.
//
// A fully closed drawer is not displayed at all (the panel and the scrim are
// `hidden`). Its resting place must not depend on animated values alone:
// Reanimated keeps an animation's resting values on the UI thread and copies
// them back into React only later, so a React re-render of a resting animated
// view (a theme change re-renders the panel for its colours) can re-apply an
// older resting value — the open one — to a closed panel, which then shows,
// open and untouchable (`pointerEvents` says closed). "Closed" is React state
// here, so no re-render can put the panel back on screen.

import { BlurTargetView, BlurView } from "expo-blur";
import * as React from "react";
import { BackHandler, PanResponder, Platform, Pressable, useWindowDimensions, View, type GestureResponderEvent, type PanResponderGestureState } from "react-native";
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { scheduleOnRN } from "react-native-worklets";

import { PANEL_SPRING } from "../lib/motion";
import { isHorizontalDrag, progressWhileClosing, progressWhileOpening, settlesOpen } from "./drawer-gesture";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);
/** The blur, with an animated `intensity` and Uniwind's `className` (third-party views ignore it otherwise). */
const StyledAnimatedBlurView = withUniwind(Animated.createAnimatedComponent(BlurView));
/** What the blur reads on Android; `className` needs the same wrapping (a dropped `flex-1` would blank the app). */
const StyledBlurTargetView = withUniwind(BlurTargetView);

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
/** How dark the scrim gets with the drawer fully open — lighter than a plain dim, the blur already sets the app back. */
const SCRIM_MAX_OPACITY = 0.25;
/** How strong the blur is with the drawer fully open (expo-blur's 1–100 scale) — enough to set the app back, not to frost it. */
const BLUR_MAX_INTENSITY = 18;
/** Android's real blur, on Android 12+ (older versions get the dim alone — the blur is too slow there). */
const ANDROID_BLUR_METHOD = "dimezisBlurViewSdk31Plus";

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
	const blurTarget = React.useRef<View>(null);
	/**
	 * Whether the drawer is on screen: from the moment it opens (or an opening
	 * drag starts) until a close has fully settled, so the panel, the scrim and
	 * the blur leave with the animation instead of vanishing when `open` turns
	 * false. Off, the panel and the scrim are not displayed and the blur is unmounted.
	 */
	const [isShown, setShown] = React.useState(open);
	if (open && !isShown) {
		// Adjusting state to a prop change during render (React's documented pattern), not in an effect.
		setShown(true);
	}
	const hide = React.useCallback((): void => {
		setShown(false);
	}, []);

	/** Springs the drawer open or closed; the drawer leaves the screen once a close has fully settled. */
	const springTo = React.useCallback(
		(target: number): void => {
			progress.set(
				withSpring(target, PANEL_SPRING, (finished?: boolean): void => {
					"worklet";
					if (finished === true && target === CLOSED) {
						scheduleOnRN(hide);
					}
				}),
			);
		},
		[progress, hide],
	);

	React.useEffect((): void => {
		springTo(open ? OPEN : CLOSED);
	}, [open, springTo]);

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
			springTo(shouldBeOpen ? OPEN : CLOSED);
			if (shouldBeOpen && !open) {
				onOpen();
			} else if (!shouldBeOpen && open) {
				onClose();
			}
		},
		[onClose, onOpen, open, springTo],
	);

	const edgeResponder = React.useMemo(
		() =>
			PanResponder.create({
				onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture: PanResponderGestureState): boolean => isHorizontalDrag(gesture.dx, gesture.dy, 1),
				// An opening drag shows the drawer from its first frame.
				onPanResponderGrant: (): void => {
					setShown(true);
				},
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
			<StyledBlurTargetView ref={blurTarget} className="flex-1">
				<View className="flex-1" accessibilityElementsHidden={open} importantForAccessibility={open ? "no-hide-descendants" : "auto"}>
					{children}
				</View>
			</StyledBlurTargetView>
			{swipeEnabled && !open ? (
				<View className="absolute inset-y-0 left-0 w-5" {...edgeResponder.panHandlers} testID={testID === undefined ? undefined : `${testID}-edge`} />
			) : null}
			{isShown ? <DrawerBlur progress={progress} blurTarget={blurTarget} testID={testID === undefined ? undefined : `${testID}-blur`} /> : null}
			<StyledAnimatedView
				pointerEvents={open ? "auto" : "none"}
				className={`absolute inset-0 ${isShown ? "" : "hidden"}`}
				style={scrimStyle}
				testID={testID === undefined ? undefined : `${testID}-scrim-layer`}>
				<View pointerEvents="none" className="absolute inset-0 bg-scrim" />
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
				className={`absolute inset-y-0 left-0 overflow-hidden rounded-r-3xl border-r border-border bg-card shadow-2xl ${isShown ? "" : "hidden"}`}
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

/**
 * Android fades a fixed blur in and out: changing the blur radius every frame
 * is too slow there, while fading is a cheap alpha change. iOS animates the
 * blur's intensity instead, because iOS renders a blur inside a view with
 * alpha below 1 incorrectly.
 */
const FADES_BLUR = Platform.OS === "android";

interface DrawerBlurProps {
	readonly progress: SharedValue<number>;
	readonly blurTarget: React.RefObject<View | null>;
	readonly testID: string | undefined;
}

/**
 * The blur behind an open drawer. Memoized on purpose: every render of
 * expo-blur re-sends its JS `intensity` to the native view, overriding the
 * animated one for a frame (a flash of full blur). Its props never change while
 * mounted, so the drawer's own re-renders (opening, closing) never reach it.
 */
const DrawerBlur = React.memo(function DrawerBlur({ progress, blurTarget, testID }: DrawerBlurProps): React.JSX.Element {
	const fadeStyle = useAnimatedStyle(() => ({ opacity: FADES_BLUR ? progress.get() : OPEN }));
	const intensityProps = useAnimatedProps(() => ({ intensity: progress.get() * BLUR_MAX_INTENSITY }));
	return (
		<StyledAnimatedView pointerEvents="none" className="absolute inset-0" style={fadeStyle} testID={testID}>
			<StyledAnimatedBlurView
				blurTarget={blurTarget}
				blurMethod={ANDROID_BLUR_METHOD}
				tint="dark"
				// The value the native view starts from: full on Android (the fade hides it), none on iOS (the animation raises it).
				intensity={FADES_BLUR ? BLUR_MAX_INTENSITY : CLOSED}
				{...(FADES_BLUR ? {} : { animatedProps: intensityProps })}
				className="absolute inset-0"
				testID={testID === undefined ? undefined : `${testID}-view`}
			/>
		</StyledAnimatedView>
	);
});
