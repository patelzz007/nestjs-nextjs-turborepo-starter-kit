// The (app) group: tabs — Home, Search, Profile, Settings (§9.2) — under the
// floating tab bar (ADR 036), inside the app drawer (ADR 038). Reachable only
// with a full session (the root guard). The drawer's store lives as long as the
// group: signing out unmounts it, so the drawer starts closed next time.
// The drawer's menu button is rendered here, once, above every tab: it never
// re-mounts as screens change (screens learn the corner is taken from
// ScreenCornerProvider). The tabs, their order, titles and icons come from
// src/features/navigation/app-tabs.ts.

import { Tabs, usePathname } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import * as React from "react";

import { AppDrawerStoreProvider } from "../../features/app-drawer/facade";
import { createAppDrawerStore } from "../../features/app-drawer/store";
import { AppDrawer } from "../../features/navigation/app-drawer";
import { AppMenuButton } from "../../features/navigation/app-menu-button";
import { AppTabBar } from "../../features/navigation/app-tab-bar";
import { APP_TABS, type AppTab } from "../../features/navigation/app-tabs";
import { isTabRoot } from "../../features/navigation/drawer-destinations";
import { ScreenCornerProvider } from "../../lib/screen-corner";
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

interface ScreenCornerScopeProps {
	readonly children: React.ReactNode;
}

/**
 * Tells the screens whether the menu button takes their corner: it shows on a
 * tab's first screen; deeper in a stack the corner belongs to the screen. The
 * pathname is read HERE, not in the layout: re-rendering the tab navigator on
 * every navigation would restart its transition and cancel the tab reset
 * (`popToTopOnBlur`) that runs when the transition ends.
 */
function ScreenCornerScope({ children }: ScreenCornerScopeProps): React.JSX.Element {
	return <ScreenCornerProvider value={isTabRoot(usePathname())}>{children}</ScreenCornerProvider>;
}

export default function AppTabsLayout(): React.JSX.Element {
	const [drawerStore] = React.useState(createAppDrawerStore);
	return (
		<AppDrawerStoreProvider store={drawerStore}>
			<AppDrawer>
				<ScreenCornerScope>
					<Tabs screenOptions={SCREEN_OPTIONS} tabBar={renderTabBar}>
						{APP_TABS.map((tab: AppTab): React.JSX.Element => (
							<Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
						))}
					</Tabs>
				</ScreenCornerScope>
				<AppMenuButton />
			</AppDrawer>
		</AppDrawerStoreProvider>
	);
}
