// The app drawer's menu (ADR 038), in display order: the five tabs first, then
// the account and preference screens that otherwise sit two taps deep under
// Settings, and — for people the API lets use them — the GitHub pull-request
// screens, and the UI kit's Components gallery (Developer). Labels use the same
// words as the screens they open. Two-factor
// authentication is reached through Security: its own route is an enrollment
// flow, not a settings page.

import BlocksIcon from "lucide-react-native/icons/blocks";
import GitPullRequestIcon from "lucide-react-native/icons/git-pull-request";
import KeyRoundIcon from "lucide-react-native/icons/key-round";
import LockKeyholeIcon from "lucide-react-native/icons/lock-keyhole";
import PaletteIcon from "lucide-react-native/icons/palette";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import SmartphoneIcon from "lucide-react-native/icons/smartphone";

import type { DrawerSectionTone } from "../../components/drawer-menu";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { ROUTES, type AppRoute } from "../../runtime/routes";
import { GITHUB_ACCOUNT_TITLE, PULL_REQUESTS_TITLE } from "../github-pull-requests/labels";
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

/** The five tabs, shown at the top of the drawer. */
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
	{
		title: "Developer",
		tone: "amber",
		destinations: [{ label: "Components", icon: BlocksIcon, route: ROUTES.components, isTab: false }],
	},
];

/** GitHub pull requests (ADR 052): shown only to people the API lets use them. */
export const GITHUB_DRAWER_GROUP: DrawerDestinationGroup = {
	title: "GitHub",
	tone: "teal",
	destinations: [
		{ label: PULL_REQUESTS_TITLE, icon: GitPullRequestIcon, route: ROUTES.pullRequests, isTab: false },
		{ label: GITHUB_ACCOUNT_TITLE, icon: KeyRoundIcon, route: ROUTES.githubAccount, isTab: false },
	],
};

const TAB_ROUTES: ReadonlySet<string> = new Set(APP_TABS.map((tab: AppTab): string => tab.route));

/** The edge swipe opens the drawer only on a tab's first screen: deeper in, it means "back". */
export function isTabRoot(pathname: string): boolean {
	return TAB_ROUTES.has(pathname);
}
