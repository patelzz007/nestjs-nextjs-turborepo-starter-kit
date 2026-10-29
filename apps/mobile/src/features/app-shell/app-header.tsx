// The app shell's header (ADR 046): the page header connected to the app. The title and subtitle
// come from the current path (features/navigation/app-screens.ts) and move the way the page does
// (header-transition.ts); a tab's first screen leads with the menu, a screen deeper in a stack leads
// with back. The header collapses with the page's scrolling (src/lib/page-header-scroll.tsx) into a
// slim bar that keeps the menu, the title and notifications. The app draws edge to edge and the
// header is the page's colour, so the status bar's icons follow the app's theme: dark on a light
// page, light on a dark one. Beside notifications, the connection and session pills, compact (in full
// in the drawer).

import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";

import { isDarkTheme } from "@workspace/tokens";

import { PageHeader } from "../../components/page-header";
import { usePageHeaderProgress, type PageHeaderScroll } from "../../lib/page-header-scroll";
import { useAppDrawerCommands } from "../app-drawer/facade";
import { NetworkStatusPill, SessionStatusPill } from "../app-status/status-pills";
import { screenHeadingOf } from "../navigation/app-screens";
import { isTabRoot } from "../navigation/drawer-destinations";
import { headerTitleDriftOf } from "../navigation/header-transition";
import { useToast } from "../toast/facade";

interface PathChange {
	readonly path: string;
	readonly drift: number;
}

const NO_DRIFT = 0;
/** The notifications button's answer until the app has a notifications inbox. */
export const NOTIFICATIONS_PLACEHOLDER = "Notifications are coming soon.";

export interface AppHeaderProps {
	/** The header's scroll link, owned by the shell. */
	readonly scroll: PageHeaderScroll;
	/** Reports the header's full expanded height, status bar included. */
	readonly onHeightChange: (height: number) => void;
	/** Reports how far the header collapses: its subtitle line's height. */
	readonly onCollapseDistanceChange: (distance: number) => void;
}

export function AppHeader({ scroll, onHeightChange, onCollapseDistanceChange }: AppHeaderProps): React.JSX.Element {
	const pathname = usePathname();
	const params = useGlobalSearchParams();
	const router = useRouter();
	const drawer = useAppDrawerCommands();
	const toast = useToast();
	const insets = useSafeAreaInsets();
	const { theme } = useUniwind();
	const [change, setChange] = React.useState<PathChange>({ path: pathname, drift: NO_DRIFT });
	if (change.path !== pathname) {
		// Which way the title moves depends on where the page came from: adjusted during render, from the previous path.
		setChange({ path: pathname, drift: headerTitleDriftOf(change.path, pathname) });
	}
	const goBack = React.useCallback((): void => {
		router.back();
	}, [router]);
	const openNotifications = React.useCallback((): void => {
		toast.info(NOTIFICATIONS_PLACEHOLDER);
	}, [toast]);
	const heading = screenHeadingOf(pathname, params);
	const progress = usePageHeaderProgress(scroll);

	return (
		<>
			<StatusBar style={isDarkTheme(theme) ? "light" : "dark"} />
			<PageHeader
				title={heading.title}
				subtitle={heading.subtitle}
				titleKey={pathname}
				titleDrift={change.drift}
				leading={isTabRoot(pathname) ? "menu" : "back"}
				onMenu={drawer.opened}
				onBack={goBack}
				onNotifications={openNotifications}
				trailing={
					<>
						<NetworkStatusPill compact testID="app-header-network" />
						<SessionStatusPill compact testID="app-header-session" />
					</>
				}
				topInset={insets.top}
				progress={progress}
				collapseDistance={scroll.collapseDistance}
				onHeightChange={onHeightChange}
				onCollapseDistanceChange={onCollapseDistanceChange}
				testID="app-header"
			/>
		</>
	);
}
