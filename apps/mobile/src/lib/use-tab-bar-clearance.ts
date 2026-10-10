// How much of the bottom of the screen the floating tab bar covers (bar, gap
// and safe area), in points. The bar floats over the content, so a scrolling
// screen pads its end by this much to keep its last item reachable. Outside
// the tabs (sign-in, the lock screen) there is no bar and nothing to clear.

import { BottomTabBarHeightContext } from "expo-router/tabs";
import * as React from "react";

const NO_TAB_BAR = 0;

export function useTabBarClearance(): number {
	return React.use(BottomTabBarHeightContext) ?? NO_TAB_BAR;
}
