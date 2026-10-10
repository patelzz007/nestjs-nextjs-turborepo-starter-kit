// The status pills in the top-right corner — opposite the menu button, the
// mobile counterpart of the admin topbar's connection and session indicators.
// Rendered once by the (app) layout above every tab, never re-mounted; like
// the menu button it shows on a tab's first screen and fades away deeper in a
// stack. Compact: the connection as an icon, the session as its countdown.
// Display only — touches pass through to the screen beneath.

import { usePathname } from "expo-router";
import * as React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CornerOverlay } from "../../components/corner-overlay";
import { NetworkStatusPill, SessionStatusPill } from "../app-status/status-pills";
import { isTabRoot } from "./drawer-destinations";

export function AppStatusCorner(): React.JSX.Element {
	const insets = useSafeAreaInsets();
	const pathname = usePathname();
	return (
		<CornerOverlay side="right" visible={isTabRoot(pathname)} topInset={insets.top} testID="app-status-corner">
			{/* As tall as the menu button, so both corners line up with the screen's title. */}
			<View pointerEvents="none" className="min-h-11 flex-row items-center gap-1.5">
				<NetworkStatusPill compact testID="app-status-corner-network" />
				<SessionStatusPill compact testID="app-status-corner-session" />
			</View>
		</CornerOverlay>
	);
}
