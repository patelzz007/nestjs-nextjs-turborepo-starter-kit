import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { useReduceMotion } from "@workspace/ui-native/lib/use-reduce-motion";
import { View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { FIRST } from "./avatar-sample";

const FULL_TURN = 360;
const TURN_MS = 3000;

// A story ring: a gradient turning slowly round the photo; still with Reduce Motion.
export function Avatar33Example(): React.JSX.Element {
	const [warningColour, violetColour] = useCSSVariable(["--color-tone-yellow", "--color-tone-violet"]);
	const warning = String(warningColour ?? "");
	const violet = String(violetColour ?? "");
	const reduceMotion = useReduceMotion();
	const turn = useSharedValue(0);
	React.useEffect((): void => {
		turn.set(reduceMotion ? 0 : withRepeat(withTiming(FULL_TURN, { duration: TURN_MS, easing: Easing.linear }), -1, false));
	}, [reduceMotion, turn]);
	const spin = useAnimatedStyle((): ViewStyle => ({ transform: [{ rotate: `${String(turn.get())}deg` }] }));
	return (
		<View className="size-[68px] items-center justify-center self-start">
			<Animated.View style={spin} className="absolute inset-0">
				<Svg width="100%" height="100%" viewBox="0 0 68 68">
					<Defs>
						<LinearGradient id="story" x1="0" y1="0" x2="1" y2="1">
							<Stop offset="0" stopColor={warning} />
							<Stop offset="1" stopColor={violet} />
						</LinearGradient>
					</Defs>
					<Circle cx="34" cy="34" r="32" stroke="url(#story)" strokeWidth="3" fill="none" />
				</Svg>
			</Animated.View>
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} accessibilityLabel={`${FIRST.name}, new story`} />
		</View>
	);
}
