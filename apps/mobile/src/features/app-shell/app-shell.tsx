// The frame of every signed-in screen (ADR 046): the app status (connection and session, derived
// once — the drawer shows it), the app drawer (ADR 038), the toasts confirming what actions did
// (ADR 047) and, laid over the screens, the shared page header — menu or back, notifications, and
// the page's title and subtitle. All of it is rendered once for the whole (app) group and never
// re-mounts as screens change; the screens learn the header's height from PageHeaderClearance and
// start their content below it, and feed it their scrolling through PageHeaderScroll.

import * as React from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PAGE_HEADER_ESTIMATED_HEIGHT, pageHeaderControlsBottom } from "../../components/page-header";
import { PageHeaderClearanceProvider } from "../../lib/page-header-clearance";
import { PageHeaderScrollProvider, type PageHeaderScroll } from "../../lib/page-header-scroll";
import { AppDrawerStoreProvider } from "../app-drawer/facade";
import { createAppDrawerStore } from "../app-drawer/store";
import { AppStatusProvider } from "../app-status/facade";
import { ToastStoreProvider } from "../toast/facade";
import { createToastStore } from "../toast/store";
import { ToastHost } from "../toast/toast-host";
import { AppDrawer } from "../navigation/app-drawer";
import { AppHeader } from "./app-header";

export interface AppShellProps {
	/** The navigator of the signed-in screens. */
	readonly children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps): React.JSX.Element {
	// The drawer's store lives as long as the shell: signing out unmounts it, so the drawer starts closed next time.
	const [drawerStore] = React.useState(createAppDrawerStore);
	const [toastStore] = React.useState(createToastStore);
	const insets = useSafeAreaInsets();
	// The header's measured height (status bar included); estimated until its first layout.
	const [headerHeight, setHeaderHeight] = React.useState<number | null>(null);
	const headerBottom = headerHeight ?? insets.top + PAGE_HEADER_ESTIMATED_HEIGHT;
	// Toasts drop in just under the header's controls (the pinned row), right below the bell — not under
	// the subtitle line, which is gone once the header collapses and would leave a gap above the toast.
	const toastTop = pageHeaderControlsBottom(insets.top);
	// The header's scroll link (src/lib/page-header-scroll.tsx): the focused page's scroll position and how far the header collapses over it.
	const scrollY = useSharedValue(0);
	const collapseDistance = useSharedValue(0);
	const headerScroll = React.useMemo((): PageHeaderScroll => ({ scrollY, collapseDistance }), [scrollY, collapseDistance]);
	const reportCollapseDistance = React.useCallback(
		(distance: number): void => {
			collapseDistance.set(distance);
		},
		[collapseDistance],
	);
	return (
		<AppStatusProvider>
			<AppDrawerStoreProvider store={drawerStore}>
				<ToastStoreProvider store={toastStore}>
					<AppDrawer>
						<PageHeaderClearanceProvider value={headerBottom}>
							<PageHeaderScrollProvider value={headerScroll}>
								<View className="flex-1">
									{children}
									<AppHeader scroll={headerScroll} onHeightChange={setHeaderHeight} onCollapseDistanceChange={reportCollapseDistance} />
									<ToastHost top={toastTop} />
								</View>
							</PageHeaderScrollProvider>
						</PageHeaderClearanceProvider>
					</AppDrawer>
				</ToastStoreProvider>
			</AppDrawerStoreProvider>
		</AppStatusProvider>
	);
}
