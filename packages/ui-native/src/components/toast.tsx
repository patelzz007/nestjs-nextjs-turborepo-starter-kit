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
//
// Beyond one line: a `title` over the message, a glyph of the caller's (or an
// avatar, `leading`), richer `content` (a file card, a list of errors), and
// `actions` (Undo, View logs). Tones `default` (no glyph) and `loading` (a
// spinner) join the four statuses; `look` draws it `soft` (the tone's card),
// `invert` (a dark card) or `accent` (a thick edge in the tone). A toast with
// no `durationMs` stays until it is closed, and shows no countdown.

import { cva, type VariantProps } from "class-variance-authority";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import InfoIcon from "lucide-react-native/icons/info";
import OctagonXIcon from "lucide-react-native/icons/octagon-x";
import TriangleAlertIcon from "lucide-react-native/icons/triangle-alert";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import {
	ActivityIndicator,
	type GestureResponderEvent,
	type LayoutChangeEvent,
	PanResponder,
	type PanResponderGestureState,
	Pressable,
	Text,
	View,
	type ViewInstance,
} from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { TOAST_MOTION } from "../lib/motion";
import { useReduceMotion } from "../lib/use-reduce-motion";
import { Icon, type LucideIcon } from "./icon";

const StyledAnimatedView = withUniwind(Animated.View);

export type ToastTone = "default" | "loading" | "success" | "info" | "warning" | "error";

/** How the card is drawn: the tone's soft card, a dark card, or the popover with a thick edge in the tone. */
export type ToastLook = "soft" | "invert" | "accent";

/** The screen edge a toast comes from. */
export type ToastEdge = "top" | "bottom";

/** The tone's glyph and its colour (Uniwind `accent-*` → the icon's `color`). */
interface ToneGlyph {
	readonly icon: LucideIcon;
	readonly iconClassName: string;
}

const TONE_GLYPHS: Readonly<Record<Exclude<ToastTone, "default" | "loading">, ToneGlyph>> = {
	success: { icon: CircleCheckIcon, iconClassName: "accent-tone-green" },
	info: { icon: InfoIcon, iconClassName: "accent-tone-blue" },
	warning: { icon: TriangleAlertIcon, iconClassName: "accent-tone-yellow" },
	error: { icon: OctagonXIcon, iconClassName: "accent-tone-red" },
};

/** The web's TOAST_TYPE_STYLES: opaque tone-soft cards with a tone border. `variant` is the tone. */
export const toastVariants = cva("overflow-hidden rounded-xl border shadow-lg", {
	variants: {
		variant: {
			default: "border-border bg-popover",
			loading: "border-border bg-popover",
			success: "border-tone-green/30 bg-tone-green-soft",
			info: "border-tone-blue/30 bg-tone-blue-soft",
			warning: "border-tone-yellow/30 bg-tone-yellow-soft",
			error: "border-tone-red/30 bg-tone-red-soft",
		},
		look: { soft: "", invert: "border-invert bg-invert", accent: "border-l-4 bg-popover" },
		size: { md: "" },
		state: { default: "", loading: "", disabled: "", error: "" },
	},
	compoundVariants: [
		{ look: "accent", variant: ["default", "loading"], className: "border-l-border" },
		{ look: "accent", variant: "success", className: "border-border border-l-tone-green" },
		{ look: "accent", variant: "info", className: "border-border border-l-tone-blue" },
		{ look: "accent", variant: "warning", className: "border-border border-l-tone-yellow" },
		{ look: "accent", variant: "error", className: "border-border border-l-tone-red" },
	],
	defaultVariants: { variant: "info", look: "soft", size: "md", state: "default" },
});

const toastTitleVariants = cva("font-sans-semibold text-body", {
	variants: {
		look: { soft: "text-foreground", invert: "text-invert-foreground", accent: "text-foreground" },
	},
	defaultVariants: { look: "soft" },
});

const toastMessageVariants = cva("text-body", {
	variants: {
		look: { soft: "", invert: "", accent: "" },
		titled: { true: "font-sans", false: "font-sans-medium" },
	},
	compoundVariants: [
		{ look: ["soft", "accent"], titled: true, className: "text-muted-foreground" },
		{ look: ["soft", "accent"], titled: false, className: "text-foreground" },
		{ look: "invert", titled: true, className: "text-invert-foreground/80" },
		{ look: "invert", titled: false, className: "text-invert-foreground" },
	],
	defaultVariants: { look: "soft", titled: false },
});

/** The countdown bar, in the tone. */
export const toastCountdownVariants = cva("h-full w-full", {
	variants: {
		variant: {
			default: "bg-muted-foreground/40",
			loading: "bg-muted-foreground/40",
			success: "bg-tone-green/55",
			info: "bg-tone-blue/55",
			warning: "bg-tone-yellow/55",
			error: "bg-tone-red/55",
		},
	},
	defaultVariants: { variant: "info" },
});

type ToastVariantProps = VariantProps<typeof toastVariants>;
export type ToastSize = NonNullable<ToastVariantProps["size"]>;

/** The close button's extra touch area around its 44 pt square. */
const CLOSE_HIT_SLOP = 4;
/** The close button's generic name (overridable through `dismissLabel`). */
const DEFAULT_DISMISS_LABEL = "Dismiss";

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
	/** A heading over the message. */
	readonly title?: string | undefined;
	/** A glyph of the caller's, in place of the tone's. */
	readonly icon?: LucideIcon | undefined;
	/** Before the text, in place of the glyph: an avatar, a tile. Decorative. */
	readonly leading?: React.ReactNode | undefined;
	/** Under the text: a file card, a list of errors, a progress bar. */
	readonly content?: React.ReactNode | undefined;
	/** Buttons under the text (Undo, View logs). */
	readonly actions?: React.ReactNode | undefined;
	readonly look?: ToastLook | undefined;
	/** Show the close button. Default `true`. */
	readonly closeButton?: boolean | undefined;
	/** How long the toast stays, in ms — the countdown bar drains over it. `null`: until closed, no countdown. */
	readonly durationMs: number | null;
	/** Distance from the toast's place to the screen's edge it comes from: it slides in from beyond it. */
	readonly offscreenOffset: number;
	/** The screen edge it slides in from (and is swiped back to). Default `top`. */
	readonly edge?: ToastEdge | undefined;
	/** Set when the toast should go: it slides out, then calls `onLeft`. */
	readonly leaving: boolean;
	/** The close button or a swipe asked to dismiss. */
	readonly onDismiss: () => void;
	/** The exit animation has finished: the caller removes the toast. */
	readonly onLeft: () => void;
	readonly size?: ToastSize;
	/** The close button's accessible name (default "Dismiss"). */
	readonly dismissLabel?: string;
	/** Extra classes for the card, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Toast = React.memo(
	React.forwardRef<ViewInstance, ToastProps>(function Toast(
		{
			tone,
			message,
			title,
			icon,
			leading,
			content,
			actions,
			look = "soft",
			closeButton = true,
			durationMs,
			offscreenOffset,
			edge = "top",
			leaving,
			onDismiss,
			onLeft,
			size = "md",
			dismissLabel = DEFAULT_DISMISS_LABEL,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const glyph = tone === "default" || tone === "loading" ? undefined : TONE_GLYPHS[tone];
		const isError = tone === "error";
		const reduceMotion = useReduceMotion();
		const presence = useSharedValue(GONE);
		const height = useSharedValue(AT_REST);
		const drag = useSharedValue(AT_REST);
		const countdown = useSharedValue(FULL);
		// Up is away for a toast from the top; down for one from the bottom.
		const toEdge = edge === "top" ? 1 : -1;

		// Arrive, and start draining the countdown — unless Reduce Motion asks for a still bar.
		React.useEffect((): void => {
			presence.set(withTiming(SHOWN, TOAST_MOTION.enter));
			// The OS answers Reduce Motion after the first render: a drain already started is put back to full.
			countdown.set(reduceMotion || durationMs === null ? FULL : withTiming(EMPTY, { duration: durationMs, easing: Easing.linear }));
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
						gesture.dy * toEdge < -SWIPE_SLOP && Math.abs(gesture.dy) > Math.abs(gesture.dx),
					onPanResponderMove: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
						drag.set(Math.min(AT_REST, gesture.dy * toEdge) * toEdge);
					},
					onPanResponderRelease: (_event: GestureResponderEvent, gesture: PanResponderGestureState): void => {
						if (gesture.dy * toEdge < -SWIPE_DISMISS_DISTANCE || gesture.vy * toEdge < -SWIPE_DISMISS_VELOCITY) {
							onDismiss();
							return;
						}
						drag.set(withSpring(AT_REST, TOAST_MOTION.settle));
					},
					onPanResponderTerminate: (): void => {
						drag.set(withSpring(AT_REST, TOAST_MOTION.settle));
					},
				}),
			[drag, onDismiss, toEdge],
		);

		const cardStyle = useAnimatedStyle(() => ({
			opacity: presence.get(),
			transform: [{ translateY: (presence.get() - SHOWN) * (offscreenOffset + height.get() + SHADOW_CLEARANCE) * toEdge + drag.get() }],
		}));
		const countdownStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: countdown.get() }], transformOrigin: "left center" }));

		return (
			<StyledAnimatedView
				ref={ref}
				onLayout={measure}
				style={cardStyle}
				// Not grouped into one element: the close button stays reachable on its own.
				accessibilityRole={isError ? "alert" : "summary"}
				accessibilityLiveRegion={isError ? "assertive" : "polite"}
				className={cn(toastVariants({ variant: tone, look, size }), className)}
				testID={testID}
				{...swipe.panHandlers}>
				<View className="min-h-14 flex-row items-start gap-3 py-3 pr-1 pl-4">
					<ToastGlyph tone={tone} look={look} icon={icon} glyph={glyph} leading={leading} />
					<View className="flex-1 gap-1 pt-0.5">
						{title === undefined ? null : <Text className={toastTitleVariants({ look })}>{title}</Text>}
						<Text className={toastMessageVariants({ look, titled: title !== undefined })}>{message}</Text>
						{content ?? null}
						{actions === undefined ? null : <View className="mt-1 flex-row flex-wrap gap-2">{actions}</View>}
					</View>
					{closeButton ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={dismissLabel}
							onPress={onDismiss}
							hitSlop={CLOSE_HIT_SLOP}
							className="-mt-2 size-11 items-center justify-center rounded-full active:opacity-60"
							testID={testID === undefined ? undefined : `${testID}-close`}>
							<Icon icon={XIcon} size="sm" colorClassName={look === "invert" ? "accent-invert-foreground" : "accent-icon"} />
						</Pressable>
					) : (
						<View className="w-3" />
					)}
				</View>
				{/* The countdown: drains in the tone over the toast's life (still under Reduce Motion); none for a toast that stays. */}
				{durationMs === null ? null : (
					<View pointerEvents="none" className="h-1 bg-muted/60">
						<StyledAnimatedView
							className={toastCountdownVariants({ variant: tone })}
							style={countdownStyle}
							testID={testID === undefined ? undefined : `${testID}-countdown`}
						/>
					</View>
				)}
			</StyledAnimatedView>
		);
	}),
);

interface ToastGlyphProps {
	readonly tone: ToastTone;
	readonly look: ToastLook;
	readonly icon: LucideIcon | undefined;
	readonly glyph: ToneGlyph | undefined;
	readonly leading: React.ReactNode;
}

/** The toast's leading part: the caller's avatar, a spinner while loading, the caller's glyph, or the tone's. */
function ToastGlyph({ tone, look, icon, glyph, leading }: ToastGlyphProps): React.JSX.Element | null {
	if (leading !== undefined && leading !== null) {
		return <View importantForAccessibility="no-hide-descendants">{leading}</View>;
	}
	if (tone === "loading") {
		return <ActivityIndicator size="small" colorClassName={look === "invert" ? "accent-invert-foreground" : "accent-muted-foreground"} />;
	}
	if (icon !== undefined) {
		return <Icon icon={icon} size="md" colorClassName={glyph?.iconClassName ?? (look === "invert" ? "accent-invert-foreground" : "accent-icon")} />;
	}
	return glyph === undefined ? null : <Icon icon={glyph.icon} size="md" colorClassName={glyph.iconClassName} />;
}
