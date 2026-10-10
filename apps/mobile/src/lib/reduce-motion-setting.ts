// The OS "Reduce Motion" setting, readable synchronously — for animation code
// that is not a React component (a navigator's scene interpolator) and must
// not re-render a navigator to learn it. It asks the OS once, on first use,
// then follows changes; until the OS answers it reports `false` (motion on).
// Components use `useReduceMotion` instead.

import { AccessibilityInfo } from "react-native";

let reduceMotionEnabled = false;
let isFollowing = false;

function follow(): void {
	isFollowing = true;
	AccessibilityInfo.isReduceMotionEnabled()
		.then((enabled: boolean): void => {
			reduceMotionEnabled = enabled;
		})
		.catch((): void => {
			// The OS could not say: keep motion on.
		});
	AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled: boolean): void => {
		reduceMotionEnabled = enabled;
	});
}

/** Whether Reduce Motion is on, as last reported by the OS. */
export function isReduceMotionOn(): boolean {
	if (!isFollowing) {
		follow();
	}
	return reduceMotionEnabled;
}
