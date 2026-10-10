// The launch screen (ADR 043): what the app shows the moment JavaScript runs,
// until the session is restored. It continues the native splash exactly — the
// same `splash` colour and the same white mark at the same size, dead centre —
// so the hand-off is invisible, then gives the launch one orchestrated moment
// (ADR 044):
//
//   1. the cube's three faces part a few points along the cube's own axes and
//      spring back together — the mark "settles";
//   2. the mark lifts and the app's name and line fade up beneath it, on the
//      tokens' emphasized curve;
//   3. while start-up continues, light travels slowly around the cube — each
//      face brightening a little in turn — so waiting reads as working.
//
// Every face is its own layer, moved on the UI thread (Reanimated). With the
// OS "Reduce Motion" setting on, everything lands in place without moving and
// the light stays still. Fades out when the app is ready. Presentational: the
// caller supplies the words. The same in light and dark.

import { BRAND_MARK_FACETS, BRAND_MARK_VIEW_BOX, type BrandMarkFacet, type BrandMarkFacetName } from "@workspace/tokens";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { Text, View } from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	FadeOut,
	interpolate,
	ReduceMotion,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withSpring,
	withTiming,
	type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

import { EMPHASIZED_ENTER_EASING, LAUNCH_MOTION } from "../lib/motion";
import { useReduceMotion } from "../lib/use-reduce-motion";

/** Reanimated's view with Uniwind's `className`. */
const StyledAnimatedView = withUniwind(Animated.View);
/** An SVG coloured by an `accent-*` token utility (`colorClassName` → `color`, used as `currentColor`). */
const FaceSvg = withUniwind(Svg);

/** The mark's size on the native splash (app.config.ts `SPLASH_IMAGE_WIDTH`): the two must match for a seamless hand-off. */
export const LAUNCH_MARK_SIZE = 96;
/** How far the faces part before settling, and how far the mark lifts, in points. */
const PART_DISTANCE = 7;
const LIFT_DISTANCE = 44;
/** How far the words rise as they appear, in points. */
const WORDS_RISE = 12;
/** How much a face brightens or dims as the light passes, as a share of its own strength. */
const LIGHT_SWING = 0.18;
const SCREEN_FADE_OUT_MS = 250;
const SCREEN_EXITING = FadeOut.duration(SCREEN_FADE_OUT_MS).reduceMotion(ReduceMotion.System);

const AT_REST = 0;
const FULL = 1;
const FOREVER = -1;
const FULL_TURN = 2 * Math.PI;
/** Faces are evenly spaced around the light's path. */
const FACE_PHASES: Readonly<Record<BrandMarkFacetName, number>> = { top: 0, left: 1 / 3, right: 2 / 3 };
/** Each face parts along the cube's own axes: the top up, the sides out and down. */
const SIN_30 = 0.5;
const COS_30 = Math.sqrt(3) / 2;
const PART_DIRECTIONS: Readonly<Record<BrandMarkFacetName, { readonly x: number; readonly y: number }>> = {
	top: { x: 0, y: -1 },
	left: { x: -COS_30, y: SIN_30 },
	right: { x: COS_30, y: SIN_30 },
};

export interface LaunchScreenProps {
	readonly title: string;
	readonly tagline: string;
	readonly testID?: string;
}

export function LaunchScreen({ title, tagline, testID }: LaunchScreenProps): React.JSX.Element {
	const reduceMotion = useReduceMotion();
	const parted = useSharedValue(AT_REST);
	const lifted = useSharedValue(AT_REST);
	const words = useSharedValue(AT_REST);
	const light = useSharedValue(AT_REST);
	const lightStrength = useSharedValue(AT_REST);

	React.useEffect((): (() => void) => {
		if (reduceMotion) {
			// Straight to the composed frame: no movement, no loop.
			lifted.set(FULL);
			words.set(FULL);
		} else {
			parted.set(withSequence(withTiming(FULL, { duration: LAUNCH_MOTION.partMs, easing: Easing.out(Easing.quad) }), withSpring(AT_REST, LAUNCH_MOTION.settleSpring)));
			lifted.set(withDelay(LAUNCH_MOTION.liftDelayMs, withTiming(FULL, { duration: LAUNCH_MOTION.liftMs, easing: EMPHASIZED_ENTER_EASING })));
			words.set(withDelay(LAUNCH_MOTION.wordsDelayMs, withTiming(FULL, { duration: LAUNCH_MOTION.wordsMs, easing: EMPHASIZED_ENTER_EASING })));
			// The light's position loops for ever; its strength fades in once, so the loop has no visible start.
			light.set(withRepeat(withTiming(FULL, { duration: LAUNCH_MOTION.lightCycleMs, easing: Easing.linear }), FOREVER));
			lightStrength.set(withDelay(LAUNCH_MOTION.lightDelayMs, withTiming(FULL, { duration: LAUNCH_MOTION.lightCycleMs / 2, easing: EMPHASIZED_ENTER_EASING })));
		}
		return (): void => {
			cancelAnimation(parted);
			cancelAnimation(lifted);
			cancelAnimation(words);
			cancelAnimation(light);
			cancelAnimation(lightStrength);
		};
	}, [light, lightStrength, lifted, parted, reduceMotion, words]);

	const markStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -LIFT_DISTANCE * lifted.get() }] }));
	const wordsStyle = useAnimatedStyle(() => ({
		opacity: words.get(),
		transform: [{ translateY: interpolate(words.get(), [AT_REST, FULL], [WORDS_RISE, AT_REST]) }],
	}));

	return (
		<StyledAnimatedView
			exiting={SCREEN_EXITING}
			className="absolute inset-0 items-center justify-center bg-splash"
			accessibilityLabel={`${title} is starting`}
			accessible
			testID={testID}>
			<StatusBar style="light" />
			<StyledAnimatedView className="size-24" style={markStyle} testID={testID === undefined ? undefined : `${testID}-mark`}>
				{BRAND_MARK_FACETS.map((facet: BrandMarkFacet): React.JSX.Element => (
					<LaunchFace key={facet.name} facet={facet} parted={parted} light={light} lightStrength={lightStrength} />
				))}
			</StyledAnimatedView>
			{/* Below the centre: the mark lifts above it, the words rise into it. */}
			<View className="absolute inset-x-8 top-1/2 mt-6 items-center">
				<StyledAnimatedView className="items-center gap-2" style={wordsStyle}>
					<Text className="font-heading text-3xl text-splash-foreground">{title}</Text>
					<Text className="text-center font-sans text-base text-splash-foreground/70">{tagline}</Text>
				</StyledAnimatedView>
			</View>
		</StyledAnimatedView>
	);
}

interface LaunchFaceProps {
	readonly facet: BrandMarkFacet;
	readonly parted: SharedValue<number>;
	readonly light: SharedValue<number>;
	readonly lightStrength: SharedValue<number>;
}

/** One face of the cube, on its own layer: it parts along its axis and catches the travelling light. */
function LaunchFace({ facet, parted, light, lightStrength }: LaunchFaceProps): React.JSX.Element {
	const direction = PART_DIRECTIONS[facet.name];
	const phase = FACE_PHASES[facet.name];
	const faceStyle = useAnimatedStyle(() => ({
		// 0 when the light is on this face, 1 opposite it: the face dims a little as the light moves on.
		opacity: facet.opacity * (FULL - LIGHT_SWING * lightStrength.get() * ((FULL - Math.cos(FULL_TURN * (light.get() - phase))) / 2)),
		transform: [{ translateX: direction.x * PART_DISTANCE * parted.get() }, { translateY: direction.y * PART_DISTANCE * parted.get() }],
	}));
	return (
		<StyledAnimatedView className="absolute inset-0" style={faceStyle}>
			<FaceSvg width={LAUNCH_MARK_SIZE} height={LAUNCH_MARK_SIZE} viewBox={BRAND_MARK_VIEW_BOX} colorClassName="accent-splash-foreground">
				<Path d={facet.path} fill="currentColor" />
			</FaceSvg>
		</StyledAnimatedView>
	);
}
