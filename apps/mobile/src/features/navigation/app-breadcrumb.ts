// The breadcrumb trail of the screen on show: where it sits in the app, the way the web admin's top bar
// shows it. The trail is read from the drawer menu this session sees (as the web reads its sidebar) by the
// resolver every app shares (@workspace/shared `resolveMenuTrail`): the deepest drawer entry that is the
// screen or one of its ancestors anchors it, the drawer section it sits in leads it (not the untitled tabs
// at the top), a branch names where it sits without a link, and the screens below an entry follow. Labels
// are the screens' own headings in the language on screen, so a crumb reads like its drawer row. A crumb
// links only to a screen this session can open (the menu is already filtered by its capabilities and
// flags, as the web's `withAccessibleLinks` does); the last crumb is the screen on show.

import {
	GROUPING_NODE_URL,
	resolveMenuTrail,
	type MenuTrailCrumb,
	type SidebarMenuTrailData,
	type SidebarMenuTrailNode,
	type SidebarMenuTrailSection,
	type SidebarTrailPage,
} from "@workspace/shared";
import type { Href } from "expo-router";
import FileIcon from "lucide-react-native/icons/file";
import HouseIcon from "lucide-react-native/icons/house";
import { z } from "zod";

import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { ROUTES } from "../../runtime/routes";
import { SHOWCASE_ROUTES } from "../showcase/showcase-routes";
import { componentNameOfSlug, screenHeadingOf, SHOWCASE_DOCS_LABEL, showcasePageOf, type ScreenParams } from "./app-screens";
import { drawerHeadingOf, type DrawerGroup, type DrawerNode } from "./drawer-destinations";
import type { NavigationLabels } from "./navigation-labels";

/** The untitled block of tabs at the top of the drawer: its items get no section crumb (the web's "Main"). */
const TABS_SECTION_KEY = "tabs";

const AppRouteSchema = z.enum(Object.values(ROUTES));

/** One crumb: its label and glyph, and where it goes (`null` on the screen on show and on a drawer branch). */
export interface AppCrumb {
	readonly key: string;
	readonly label: string;
	readonly icon: LucideIcon;
	readonly href: Href | null;
}

/** The drawer's groups as the shared resolver reads a menu, with each entry's glyph by its id. */
interface TrailMenu {
	readonly menu: SidebarMenuTrailData;
	readonly icons: ReadonlyMap<string, LucideIcon>;
}

function trailNodeOf(node: DrawerNode, labels: NavigationLabels, icons: Map<string, LucideIcon>): SidebarMenuTrailNode {
	icons.set(node.id, node.icon);
	const base = { title: drawerHeadingOf(node, labels).title, icon: node.id };
	return node.kind === "screen"
		? { ...base, url: node.route }
		: { ...base, url: GROUPING_NODE_URL, children: node.children.map((child: DrawerNode): SidebarMenuTrailNode => trailNodeOf(child, labels, icons)) };
}

/** The session's drawer, in the language on screen, as a menu the trail resolver walks. */
export function trailMenuOf(groups: readonly DrawerGroup[], labels: NavigationLabels): TrailMenu {
	const icons = new Map<string, LucideIcon>();
	const sections = groups.map((group: DrawerGroup): SidebarMenuTrailSection => ({
		title: group.heading === null ? "" : labels.sections[group.heading.section],
		key: group.heading === null ? TABS_SECTION_KEY : group.heading.section,
		items: group.nodes.map((node: DrawerNode): SidebarMenuTrailNode => trailNodeOf(node, labels, icons)),
	}));
	return { menu: { sections, bottomItems: [] }, icons };
}

/** The short name of the screen at `pathname` for its crumb, or `null` where the app has no screen. */
export function crumbLabelOf(pathname: string, params: ScreenParams, labels: NavigationLabels): string | null {
	const showcase = showcasePageOf(pathname);
	if (showcase !== null) {
		return showcase.docs ? SHOWCASE_DOCS_LABEL : componentNameOfSlug(showcase.slug);
	}
	const { title } = screenHeadingOf(pathname, params, labels);
	return title === "" ? null : title;
}

/** Where a crumb's link goes: one of the app's routes, or a showcase component's screen; `null` for any other path. */
export function crumbHrefOf(path: string): Href | null {
	const route = AppRouteSchema.safeParse(path);
	if (route.success) {
		return route.data;
	}
	const showcase = showcasePageOf(path);
	return showcase === null || showcase.docs ? null : SHOWCASE_ROUTES.component(showcase.slug);
}

/** The trail of the screen at `pathname` (`params` are its own search params), from the drawer this session sees. */
export function resolveAppTrail(pathname: string, params: ScreenParams, groups: readonly DrawerGroup[], labels: NavigationLabels): readonly AppCrumb[] {
	const { menu, icons } = trailMenuOf(groups, labels);
	const resolvePage = (path: string): SidebarTrailPage | null => {
		// The screen on show is named with its own params (a pull request's number); a screen above it with none.
		const label = crumbLabelOf(path, path === pathname ? params : {}, labels);
		return label === null ? null : { label };
	};
	const trail = resolveMenuTrail<LucideIcon>({
		menu,
		pathname,
		resolveIcon: (id: string | undefined): LucideIcon => (id === undefined ? FileIcon : (icons.get(id) ?? FileIcon)),
		rootCurrentLabel: labels.headings.index.title,
		rootIcon: HouseIcon,
		pageIcon: FileIcon,
		unknownFallbackLabel: labels.headings.index.title,
		catchAllSectionKey: TABS_SECTION_KEY,
		resolvePage,
	});
	return trail.map((crumb: MenuTrailCrumb<LucideIcon>, position: number): AppCrumb => ({
		key: `${String(position)}:${crumb.label}`,
		label: crumb.label,
		icon: crumb.icon,
		href: crumb.href === undefined ? null : crumbHrefOf(crumb.href),
	}));
}
