// A toast: one short message confirming what an action did — the web toast's
// design and motion (packages/ui/src/components/toast.tsx), on the phone.
//
// Look: an opaque tone-soft card with a matching 30 % tone border, the tone's
// icon (check, info, triangle, octagon-x), the message in the foreground
// colour, a close button, and a countdown bar in the tone that drains over the
// toast's life.
//
// Motion (all on the UI thread, Reanimated shared values): it slides down
// from fully above the screen on the tokens' overlay curve (500 ms, as the
// web), and leaves the same way, quicker (300 ms). It can be swiped up to
// dismiss; a short drag springs back. With Reduce Motion on, nothing slides
// and the countdown bar stays full (the web's `motion-reduce`).
//
// Presentational and controlled: the caller says when it is `leaving`, and
// hears `onDismiss` (close, swipe) and `onLeft` (the exit has finished).

import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import InfoIcon from "lucide-react-native/icons/info";
import OctagonXIcon from "lucide-react-native/icons/octagon-x";
import TriangleAlertIcon from "lucide-react-native/icons/triangle-alert";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { PanResponder, Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent, type PanResponderGestureState } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { withUniwind } from "uniwind";

import { TOAST_MOTION } from "../lib/motion";
import { useReduceMotion } from "../lib/use-reduce-motion";
import { Icon, type LucideIcon } from "./icon";

const StyledAnimatedView = withUniwind(Animated.View);

export type ToastTone = "success" | "info" | "warning" | "error";

interface ToneLook {
	readonly icon: LucideIcon;
	readonly iconClassName: string;
	readonly cardClassName: string;
	readonly countdownClassName: string;
}

/** The web's TOAST_TYPE_STYLES: opaque tone-soft cards, tone glyph, tone countdown. */
const TONES: Readonly<Record<ToastTone, ToneLook>> = {
	success: { icon: CircleCheckIcon, iconClassName: "accent-tone-green", cardClassName: "border-tone-green/30 bg-tone-green-soft", countdownClassName: "bg-tone-green/55" },
	info: { icon: InfoIcon, iconClassName: "accent-tone-blue", cardClassName: "border-tone-blue/30 bg-tone-blue-soft", countdownClassName: "bg-tone-blue/55" },
	warning: {
		icon: TriangleAlertIcon,
		iconClassName: "accent-tone-yellow",
		cardClassName: "border-tone-yellow/30 bg-tone-yellow-soft",
		countdownClassName: "bg-tone-yellow/55",
	},
	error: { icon: OctagonXIcon, iconClassName: "accent-tone-red", cardClassName: "border-tone-red/30 bg-tone-red-soft", countdownClassName: "bg-tone-red/55" },
};

const GONE = 0;
const SHOWN = 1;
const FULL = 1;
const EMPTY = 0;
const AT_REST = 0;
/** Past this upward drag (points), or this upward speed, a swipe dismisses. */
const SWIPE_DISMISS_DISTANCE = 40;
const SWIPE_DISMISS_VELOCITY = 0.5;
/** A drag starts only once the finger has moved this far up, and more up than sideways. */
const SWIPE_SLOP = 4;
/** Extra travel above the screen's edge, so the shadow leaves too. */
const SHADOW_CLEARANCE = 16;

export interface ToastProps {
	readonly tone: ToastTone;
	readonly message: string;
	/** How long the toast stays, in ms — the countdown bar drains over it. */
	readonly durationMs: number;
	/** Distance from the toast's place up to the screen's top edge: it slides in from beyond it. */
	readonly offscreenOffset: number;
	/** Set when the toast should go: it slides out, then calls `onLeft`. */
	readonly leaving: boolean;
	/** The close button or a swipe asked to dismiss. */
	readonly onDismiss: () => void;
	/** The exit animation has finished: the caller removes the toast. */
	readonly onLeft: () => void;
	readonly testID?: string;
}

export function Toast({ tone, message, durationMs, offscreenOffset, leaving, onDismiss, onLeft, testID }: ToastProps): React.JSX.Element {
	const look = TONES[tone];
	const isError = tone === "error";
	const reduceMotion = useReduceMotion();
	const presence = useSharedValue(GONE);
	const height = useSharedValue(AT_REST);
	const drag = useSharedValue(AT_REST);
	const countdown = useSharedValue(FULL);

	// Arrive, and start draining the countdown — unless Reduce Motion asks for a still bar.
	React.useEffect((): void => {
		presence.set(withTiming(SHOWN, TOAST_MOTION.enter));
		if (!reduceMotion) {
			countdown.set(withTiming(EMPTY, { duration: durationMs, easing: Easing.linear }));
		}
	}, [countdown, durationMs, presence, reduceMotion]);

	React.useEffect((): void => {
		if (!leaving) {
			return;
		}
		presence.set(
			withTiming(GONE, TOAST_MOTION.exit, (finished?: boolean): void => {
				"worklet";
				if (finished === true) {
					scheduleOnRN(onLeft);
				}
			}),
		);
	}, [leaving, onLeft, presence]);

	const measure = React.useCallback(
		(event: LayoutChangeEvent): void => {
			height.set(event.nativeEvent.layout.height);
		},
		[height],
	);

	const swipe = React.useMemo(
		() =>
			PanResponder.create({
				onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture: PanResponderGestureState): boolean =>
					gesture.dy < -SWIPE_SLOP && Math.abs(gesture.dy) > Math.abs(gesture.dx),
				onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
					drag.set(Math.min(AT_REST, gesture.dy));
				},
				onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
					if (gesture.dy < -SWIPE_DISMISS_DISTANCE || gesture.vy < -SWIPE_DISMISS_VELOCITY) {
						onDismiss();
						return;
					}
					drag.set(withSpring(AT_REST, TOAST_MOTION.settle));
				},
				onPanResponderTerminate: (): void => {
					drag.set(withSpring(AT_REST, TOAST_MOTION.settle));
				},
			}),
		[drag, onDismiss],
	);

	const cardStyle = useAnimatedStyle(() => ({
		opacity: presence.get(),
		transform: [{ translateY: (presence.get() - SHOWN) * (offscreenOffset + height.get() + SHADOW_CLEARANCE) + drag.get() }],
	}));
	const countdownStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: countdown.get() }], transformOrigin: "left center" }));

	return (
		<StyledAnimatedView
			onLayout={measure}
			style={cardStyle}
			// Not grouped into one element: the close button stays reachable on its own.
			accessibilityRole={isError ? "alert" : "summary"}
			accessibilityLiveRegion={isError ? "assertive" : "polite"}
			className={`overflow-hidden rounded-xl border shadow-lg ${look.cardClassName}`}
			testID={testID}
			{...swipe.panHandlers}>
			<View className="min-h-14 flex-row items-center gap-3 py-2 pr-1 pl-4">
				<Icon icon={look.icon} size="md" colorClassName={look.iconClassName} />
				<Text className="font-sans-medium flex-1 text-sm text-foreground">{message}</Text>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Dismiss"
					onPress={onDismiss}
					hitSlop={4}
					className="size-11 items-center justify-center rounded-full active:opacity-60"
					testID={testID === undefined ? undefined : `${testID}-close`}>
					<Icon icon={XIcon} size="sm" colorClassName="accent-muted-foreground" />
				</Pressable>
			</View>
			{/* The countdown: drains in the tone over the toast's life (still under Reduce Motion). */}
			<View pointerEvents="none" className="h-1 bg-muted/60">
				<StyledAnimatedView className={`h-full w-full ${look.countdownClassName}`} style={countdownStyle} testID={testID === undefined ? undefined : `${testID}-countdown`} />
			</View>
		</StyledAnimatedView>
	);
}
