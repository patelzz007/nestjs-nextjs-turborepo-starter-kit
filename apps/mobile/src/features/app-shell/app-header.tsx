// The app shell's header (ADR 046): the page header connected to the app. The
// title comes from the current path (features/navigation/app-screens.ts) and
// moves the way the page does (header-transition.ts); a tab's first screen
// leads with the menu, a screen deeper in a stack leads with back. On the
// right, the connection and session pills, compact.

import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import * as React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PageHeader } from "../../components/page-header";
import { useAppDrawerCommands } from "../app-drawer/facade";
import { NetworkStatusPill, SessionStatusPill } from "../app-status/status-pills";
import { screenTitleOf } from "../navigation/app-screens";
import { isTabRoot } from "../navigation/drawer-destinations";
import { headerTitleDriftOf } from "../navigation/header-transition";

interface PathChange {
	readonly path: string;
	readonly drift: number;
}

const NO_DRIFT = 0;

export function AppHeader(): React.JSX.Element {
	const pathname = usePathname();
	const params = useGlobalSearchParams();
	const router = useRouter();
	const drawer = useAppDrawerCommands();
	const insets = useSafeAreaInsets();
	const [change, setChange] = React.useState<PathChange>({ path: pathname, drift: NO_DRIFT });
	if (change.path !== pathname) {
		// Which way the title moves depends on where the page came from: adjusted during render, from the previous path.
		setChange({ path: pathname, drift: headerTitleDriftOf(change.path, pathname) });
	}
	const goBack = React.useCallback((): void => {
		router.back();
	}, [router]);

	return (
		<PageHeader
			title={screenTitleOf(pathname, params)}
			titleKey={pathname}
			titleDrift={change.drift}
			leading={isTabRoot(pathname) ? "menu" : "back"}
			onMenu={drawer.opened}
			onBack={goBack}
			topInset={insets.top}
			trailing={
				<>
					<NetworkStatusPill compact testID="app-header-network" />
					<SessionStatusPill compact testID="app-header-session" />
				</>
			}
			testID="app-header"
		/>
	);
}
