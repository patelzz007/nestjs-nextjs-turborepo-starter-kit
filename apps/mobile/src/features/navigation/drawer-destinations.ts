// The app drawer's menu (ADR 038), in display order: the four tabs first, then
// the account and preference screens that otherwise sit two taps deep under
// Settings. Labels use the same words as the screens they open. Two-factor
// authentication is reached through Security: its own route is an enrollment
// flow, not a settings page.

import LockKeyholeIcon from "lucide-react-native/icons/lock-keyhole";
import PaletteIcon from "lucide-react-native/icons/palette";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import SmartphoneIcon from "lucide-react-native/icons/smartphone";

import type { DrawerSectionTone } from "../../components/drawer-menu";
import type { LucideIcon } from "../../components/icon";
import { ROUTES, type AppRoute } from "../../runtime/routes";
import { APP_TABS, type AppTab } from "./app-tabs";

export interface DrawerDestination {
	readonly label: string;
	readonly icon: LucideIcon;
	readonly route: AppRoute;
	/** A tab is switched to; any other screen is pushed onto its tab's stack. */
	readonly isTab: boolean;
}

export interface DrawerDestinationGroup {
	/** Shown above the group, sentence case. */
	readonly title: string;
	/** The dot before the title. */
	readonly tone: DrawerSectionTone;
	readonly destinations: readonly DrawerDestination[];
}

/** The four tabs, shown as the drawer's tile grid. */
export const DRAWER_TABS: readonly DrawerDestination[] = APP_TABS.map((tab: AppTab): DrawerDestination => ({
	label: tab.title,
	icon: tab.icon,
	route: tab.route,
	isTab: true,
}));

/** The screens under Settings, grouped as on the Settings screen. */
export const DRAWER_GROUPS: readonly DrawerDestinationGroup[] = [
	{
		title: "Account",
		tone: "blue",
		destinations: [
			{ label: "Security", icon: ShieldCheckIcon, route: ROUTES.security, isTab: false },
			{ label: "Signed-in devices", icon: SmartphoneIcon, route: ROUTES.devices, isTab: false },
		],
	},
	{
		title: "Preferences",
		tone: "purple",
		destinations: [
			{ label: "Appearance", icon: PaletteIcon, route: ROUTES.appearance, isTab: false },
			{ label: "App lock", icon: LockKeyholeIcon, route: ROUTES.appLock, isTab: false },
		],
	},
];

const TAB_ROUTES: ReadonlySet<string> = new Set(APP_TABS.map((tab: AppTab): string => tab.route));

/** The edge swipe opens the drawer only on a tab's first screen: deeper in, it means "back". */
export function isTabRoot(pathname: string): boolean {
	return TAB_ROUTES.has(pathname);
}
