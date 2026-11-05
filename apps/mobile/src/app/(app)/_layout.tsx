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
import { withRootGate } from "../../runtime/root-navigator";
import { AppTabBar } from "../../features/navigation/app-tab-bar";
import { FreezeHiddenTab } from "../../features/navigation/freeze-hidden-tab";
import { APP_TABS, type AppTab } from "../../features/navigation/app-tabs";
import { useLabels } from "../../features/language/use-app-language";
import { NAVIGATION_LABELS } from "../../features/navigation/navigation-labels";
import { TAB_TRANSITION_SPEC, tabSceneStyle } from "../../lib/screen-transitions";

/**
 * Leaving a tab resets its stack (features/navigation/reset-tab-stack), so coming back to
 * Settings shows Settings — not the sub-screen (Appearance, Security, …) last open there. A tab out of sight is
 * frozen (`screenLayout`): it does not re-render until shown again, so a theme change restyles only the tab on screen (6.7).
 */
type TabScreenOptions = React.ComponentProps<typeof Tabs>["screenOptions"];
type TabLayoutProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["screenLayout"]>>[0];

const SCREEN_OPTIONS = {
	headerShown: false,
	transitionSpec: TAB_TRANSITION_SPEC,
	sceneStyleInterpolator: tabSceneStyle,
} satisfies TabScreenOptions;

function renderTabBar(props: BottomTabBarProps): React.JSX.Element {
	return <AppTabBar {...props} />;
}

/** Every tab is frozen while out of sight, once its stack has been reset (features/navigation/freeze-hidden-tab). */
function renderTabLayout({ children }: TabLayoutProps): React.JSX.Element {
	return <FreezeHiddenTab>{children}</FreezeHiddenTab>;
}

function AppTabsLayout(): React.JSX.Element {
	const { headings } = useLabels(NAVIGATION_LABELS);
	return (
		<AppShell>
			<Tabs screenOptions={SCREEN_OPTIONS} tabBar={renderTabBar} screenLayout={renderTabLayout}>
				{APP_TABS.map((tab: AppTab): React.JSX.Element => (
					<Tabs.Screen key={tab.name} name={tab.name} options={{ title: headings[tab.name].title }} />
				))}
			</Tabs>
		</AppShell>
	);
}

export default withRootGate(["app"], AppTabsLayout);
