import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { useReduceMotion } from "@workspace/ui-native/lib/use-reduce-motion";
import { View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { FIRST } from "./avatar-sample";

/** How far the ring grows, and how long one beat takes. */
const PULSE_SCALE = 1.12;
const PULSE_MS = 900;

// A green ring pulsing around a live photo, with a presence dot; still with Reduce Motion.
export function Avatar32Example(): React.JSX.Element {
	const reduceMotion = useReduceMotion();
	const pulse = useSharedValue(1);
	React.useEffect((): void => {
		pulse.set(reduceMotion ? 1 : withRepeat(withTiming(PULSE_SCALE, { duration: PULSE_MS }), -1, true));
	}, [pulse, reduceMotion]);
	const ring = useAnimatedStyle((): ViewStyle => ({ transform: [{ scale: pulse.get() }], opacity: 2 - pulse.get() }));
	return (
		<View className="items-center justify-center self-start p-2">
			<Animated.View style={ring} className="absolute inset-0 rounded-full border-2 border-tone-green" />
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} badges={[{ label: "Live now", color: "success" }]} />
		</View>
	);
}
