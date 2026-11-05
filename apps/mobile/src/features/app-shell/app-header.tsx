// The app shell's header (ADR 046): the page header connected to the app. The title and subtitle
// come from the current path (features/navigation/app-screens.ts) and move the way the page does
// (header-transition.ts); a tab's first screen leads with the menu, a screen deeper in a stack leads
// with back. The header collapses with the page's scrolling (src/lib/page-header-scroll.tsx) into a
// slim bar that keeps the menu, the title and notifications. The app draws edge to edge and the
// header is the page's colour, so the status bar's icons follow the app's theme: dark on a light
// page, light on a dark one. Search opens the command palette (ADR 079); the connection and session
// pills live in the drawer. The bell carries the unread count, live (contexts/notifications).

import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";

import { isDarkTheme } from "@workspace/tokens";

import { PageHeader } from "../../components/page-header";
import { useUnreadNotifications } from "../../contexts/notifications";
import { usePageHeaderProgress, type PageHeaderScroll } from "../../lib/page-header-scroll";
import { ROUTES } from "../../runtime/routes";
import { useAppDrawerCommands } from "../app-drawer/facade";
import { useLabels } from "../language/use-app-language";
import { screenHeadingOf } from "../navigation/app-screens";
import { AppCommandPalette } from "../navigation/app-command-palette";
import { NAVIGATION_LABELS } from "../navigation/navigation-labels";
import { isTabRoot } from "../navigation/drawer-destinations";
import { headerTitleDriftOf } from "../navigation/header-transition";

interface PathChange {
	readonly path: string;
	readonly drift: number;
}

const NO_DRIFT = 0;
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
		// `withAnchor`: the Settings tab's first screen goes underneath, as the drawer opens its screens, so
		// "back" and a press on the Settings tab land on Settings, not on a stack holding only Notifications.
		router.push(ROUTES.notifications, { withAnchor: true });
	}, [router]);
	const [paletteOpen, setPaletteOpen] = React.useState(false);
	const openPalette = React.useCallback((): void => {
		setPaletteOpen(true);
	}, []);
	const closePalette = React.useCallback((): void => {
		setPaletteOpen(false);
	}, []);
	const unreadNotifications = useUnreadNotifications();
	const navigationLabels = useLabels(NAVIGATION_LABELS);
	const heading = screenHeadingOf(pathname, params, navigationLabels);
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
				onSearch={openPalette}
				notificationCount={unreadNotifications}
				topInset={insets.top}
				progress={progress}
				collapseDistance={scroll.collapseDistance}
				onHeightChange={onHeightChange}
				onCollapseDistanceChange={onCollapseDistanceChange}
				testID="app-header"
			/>
			<AppCommandPalette visible={paletteOpen} onClose={closePalette} />
		</>
	);
}
