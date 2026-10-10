// How the app moves between screens — one set of transitions, named here and
// used by every navigator, so the app moves the same way on iOS and Android
// (each platform's defaults differ). The curves come from the design tokens
// (packages/tokens MOTION), the same ones the web uses for emphasized motion.
// Stack transitions are native and follow the OS "Reduce Motion" setting. The
// tab transition runs on React Native's native-driven Animated, which does not:
// with Reduce Motion on, its drift is dropped and it becomes a plain dissolve
// (movement replaced by a fade). The setting is read here, not by the tabs
// layout — re-rendering the tab navigator mid-switch would restart its
// transition and cancel the tab reset that follows it.

import { MOTION } from "@workspace/tokens";
import type { BottomTabNavigationOptions } from "expo-router/tabs";
import { Easing } from "react-native";
import type { StackAnimationTypes } from "react-native-screens";

import { isReduceMotionOn } from "./reduce-motion-setting";

/** Opening a screen within a stack (Settings → Security, Sign in → Sign up): the iOS push, the screen below drifting behind. */
export const PUSH_TRANSITION: StackAnimationTypes = "ios_from_right";

/** The root guard moving between groups (onboarding → sign-in → the app): a cross-fade, as a change of context rather than a step deeper. */
export const ROOT_TRANSITION: StackAnimationTypes = "fade";

const { "ease-emphasized-enter": EMPHASIZED_ENTER } = MOTION;

/** Decelerating: quick to respond, long gentle settle — the token's `ease-emphasized-enter`. */
export const EMPHASIZED_EASING = Easing.bezier(EMPHASIZED_ENTER.x1, EMPHASIZED_ENTER.y1, EMPHASIZED_ENTER.x2, EMPHASIZED_ENTER.y2);
/** Long enough to read as motion, short enough never to wait on it. */
const TAB_TRANSITION_MS = 260;
/** How far a tab drifts while it fades — a hint of direction, not a slide. */
const TAB_DRIFT = 16;
/** A tab's position relative to the selected one: before it, it, after it. */
const BEFORE = -1;
const SELECTED = 0;
const AFTER = 1;
const HIDDEN = 0;
const VISIBLE = 1;

/** Switching tabs: a quick cross-fade with a short drift toward the side the new tab sits on. */
export const TAB_TRANSITION_SPEC: NonNullable<BottomTabNavigationOptions["transitionSpec"]> = {
	animation: "timing",
	config: { duration: TAB_TRANSITION_MS, easing: EMPHASIZED_EASING },
};

export const tabSceneStyle: NonNullable<BottomTabNavigationOptions["sceneStyleInterpolator"]> = ({ current }) => {
	const drift = isReduceMotionOn() ? SELECTED : TAB_DRIFT;
	return {
		sceneStyle: {
			opacity: current.progress.interpolate({ inputRange: [BEFORE, SELECTED, AFTER], outputRange: [HIDDEN, VISIBLE, HIDDEN] }),
			transform: [{ translateX: current.progress.interpolate({ inputRange: [BEFORE, SELECTED, AFTER], outputRange: [-drift, SELECTED, drift] }) }],
		},
	};
};
