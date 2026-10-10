// The app drawer's menu button (ADR 038), rendered once by the (app) layout
// above every tab: it never re-mounts as screens change, so the icon never
// flickers. It shows on a tab's first screen — where the screen's title sits
// beside it — and fades away deeper in a stack, where that corner belongs to
// the screen.

import { usePathname } from "expo-router";
import MenuIcon from "lucide-react-native/icons/menu";
import * as React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CornerButton } from "../../components/corner-button";
import { useAppDrawerCommands } from "../app-drawer/facade";
import { isTabRoot } from "./drawer-destinations";

export function AppMenuButton(): React.JSX.Element {
	const drawer = useAppDrawerCommands();
	const insets = useSafeAreaInsets();
	const pathname = usePathname();
	return <CornerButton icon={MenuIcon} accessibilityLabel="Open menu" onPress={drawer.opened} visible={isTabRoot(pathname)} topInset={insets.top} testID="app-menu-button" />;
}
