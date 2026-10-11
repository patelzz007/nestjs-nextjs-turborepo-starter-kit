// The frame of every signed-in screen (ADR 046): the app status (connection and
// session, derived once), the app drawer (ADR 038) and, laid over the screens,
// the page header — menu or back, the page's title, the status pills. All of
// it is rendered once for the whole (app) group and never re-mounts as screens
// change; the screens learn the header's height from PageHeaderClearance and
// start their content below it.

import * as React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PAGE_HEADER_FADE_HEIGHT, PAGE_HEADER_ROW_HEIGHT } from "../../components/page-header";
import { PageHeaderClearanceProvider } from "../../lib/page-header-clearance";
import { AppDrawerStoreProvider } from "../app-drawer/facade";
import { createAppDrawerStore } from "../app-drawer/store";
import { AppStatusProvider } from "../app-status/facade";
import { AppDrawer } from "../navigation/app-drawer";
import { AppHeader } from "./app-header";

export interface AppShellProps {
	/** The navigator of the signed-in screens. */
	readonly children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps): React.JSX.Element {
	// The drawer's store lives as long as the shell: signing out unmounts it, so the drawer starts closed next time.
	const [drawerStore] = React.useState(createAppDrawerStore);
	const insets = useSafeAreaInsets();
	return (
		<AppStatusProvider>
			<AppDrawerStoreProvider store={drawerStore}>
				<AppDrawer>
					<PageHeaderClearanceProvider value={insets.top + PAGE_HEADER_ROW_HEIGHT + PAGE_HEADER_FADE_HEIGHT}>
						<View className="flex-1">
							{children}
							<AppHeader />
						</View>
					</PageHeaderClearanceProvider>
				</AppDrawer>
			</AppDrawerStoreProvider>
		</AppStatusProvider>
	);
}
