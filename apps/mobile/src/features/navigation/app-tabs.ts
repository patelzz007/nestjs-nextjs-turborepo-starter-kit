// The (app) group's tabs, in the order the tab bar shows them: one entry per
// route file directly inside src/app/(app). The tabs layout declares its
// screens from this list and the tab bar takes each tab's icon from it, so a
// tab is added or reordered here and nowhere else. Its title, in every
// language, is its heading in navigation-labels.ts (keyed by `name`).

import ChartColumnIcon from "lucide-react-native/icons/chart-column";
import HouseIcon from "lucide-react-native/icons/house";
import SearchIcon from "lucide-react-native/icons/search";
import SettingsIcon from "lucide-react-native/icons/settings";
import UserIcon from "lucide-react-native/icons/user";

import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { ROUTES, type AppRoute } from "../../runtime/routes";

/** A tab's route name: its file name inside src/app/(app) (`index` is Home). */
export type AppTabName = "index" | "analytics" | "search" | "profile" | "settings";

export interface AppTab {
	readonly name: AppTabName;
	readonly icon: LucideIcon;
	/** Where the tab lives (the drawer links to it). */
	readonly route: AppRoute;
}

export const APP_TABS: readonly AppTab[] = [
	{ name: "index", icon: HouseIcon, route: ROUTES.home },
	{ name: "analytics", icon: ChartColumnIcon, route: ROUTES.analytics },
	{ name: "search", icon: SearchIcon, route: ROUTES.search },
	{ name: "profile", icon: UserIcon, route: ROUTES.profile },
	{ name: "settings", icon: SettingsIcon, route: ROUTES.settings },
];

const APP_TABS_BY_NAME: ReadonlyMap<string, AppTab> = new Map(APP_TABS.map((tab: AppTab): [string, AppTab] => [tab.name, tab]));

/** The tab a navigator route belongs to; `undefined` for a route that is not a tab. */
export function appTabOf(routeName: string): AppTab | undefined {
	return APP_TABS_BY_NAME.get(routeName);
}
