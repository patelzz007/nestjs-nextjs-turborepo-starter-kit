// The (app) group: tabs — Home, Analytics, Search, Profile, Settings (§9.2) — under the
// floating tab bar (ADR 036), inside the app shell (ADR 046): the drawer
// (ADR 038) and the page header, rendered once above every screen. Reachable
// only with a full session (the root guard). The tabs, their order, titles and
// icons come from src/features/navigation/app-tabs.ts; each screen's header
// title from src/features/navigation/app-screens.ts.

import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import * as React from "react";

import { AppShell } from "../../features/app-shell/app-shell";
import { AppTabBar } from "../../features/navigation/app-tab-bar";
import { APP_TABS, type AppTab } from "../../features/navigation/app-tabs";
import { TAB_TRANSITION_SPEC, tabSceneStyle } from "../../lib/screen-transitions";

/**
 * `popToTopOnBlur`: leaving a tab resets its stack, so coming back to Settings
 * shows Settings — not the sub-screen (Appearance, Security, …) last open there.
 */
type TabScreenOptions = React.ComponentProps<typeof Tabs>["screenOptions"];

const SCREEN_OPTIONS = { headerShown: false, popToTopOnBlur: true, transitionSpec: TAB_TRANSITION_SPEC, sceneStyleInterpolator: tabSceneStyle } satisfies TabScreenOptions;

function renderTabBar(props: BottomTabBarProps): React.JSX.Element {
	return <AppTabBar {...props} />;
}

export default function AppTabsLayout(): React.JSX.Element {
	return (
		<AppShell>
			<Tabs screenOptions={SCREEN_OPTIONS} tabBar={renderTabBar}>
				{APP_TABS.map((tab: AppTab): React.JSX.Element => (
					<Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
				))}
			</Tabs>
		</AppShell>
	);
}
