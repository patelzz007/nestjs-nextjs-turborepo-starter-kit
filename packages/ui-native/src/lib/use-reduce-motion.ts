// Whether the OS "Reduce Motion" setting is on, kept current while it changes.
// For motion that is not a Reanimated spring (springs take
// `ReduceMotion.System` in their config instead — lib/motion.ts): a looping
// pulse, for one, simply stays still. Starts `false` until the OS answers.

import * as React from "react";
import { AccessibilityInfo } from "react-native";

export function useReduceMotion(): boolean {
	const [enabled, setEnabled] = React.useState(false);

	React.useEffect((): (() => void) => {
		let active = true;
		AccessibilityInfo.isReduceMotionEnabled()
			.then((isEnabled: boolean): void => {
				if (active) {
					setEnabled(isEnabled);
				}
			})
			.catch((): void => {
				// The OS could not say: keep the default (motion on).
			});
		const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setEnabled);
		return (): void => {
			active = false;
			subscription.remove();
		};
	}, []);

	return enabled;
}
