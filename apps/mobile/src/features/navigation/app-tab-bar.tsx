// The (app) tabs' bar: connects Expo Router's tab navigator to the
// presentational FloatingTabBar. It decides which tab is selected, what a press
// does (React Navigation's tab-press contract, so a re-press still pops a
// nested stack to its root), when to give haptic feedback, and hides the bar
// while the keyboard is open.

import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from "expo-router/tabs";
import * as React from "react";

import { FloatingTabBar, type FloatingTabBarItem } from "../../components/floating-tab-bar";
import { playSelectionFeedback } from "../../lib/haptics";
import { useKeyboardVisible } from "../../lib/use-keyboard-visible";
import { appTabOf } from "./app-tabs";

export function AppTabBar({ state, navigation, insets }: BottomTabBarProps): React.JSX.Element | null {
	const keyboardVisible = useKeyboardVisible();
	// Set by the navigator: what it reports to screens as the tab bar's height (src/components/screen.tsx).
	const reportHeight = React.use(BottomTabBarHeightCallbackContext);

	const items = React.useMemo(
		(): readonly FloatingTabBarItem[] =>
			state.routes.flatMap((route, position): FloatingTabBarItem[] => {
				const tab = appTabOf(route.name);
				if (tab === undefined) {
					return [];
				}
				const selected = position === state.index;
				return [
					{
						key: route.key,
						label: tab.title,
						icon: tab.icon,
						selected,
						testID: `tab-${tab.name}`,
						onPress: (): void => {
							const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
							if (!selected && !event.defaultPrevented) {
								playSelectionFeedback();
								navigation.navigate(route.name, route.params);
							}
						},
						onLongPress: (): void => {
							navigation.emit({ type: "tabLongPress", target: route.key });
						},
					},
				];
			}),
		[navigation, state.index, state.routes],
	);

	if (keyboardVisible) {
		return null;
	}
	return <FloatingTabBar items={items} bottomInset={insets.bottom} onHeightChange={reportHeight} testID="app-tab-bar" />;
}
