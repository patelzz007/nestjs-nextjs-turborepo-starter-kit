// The app drawer's menu (ADR 038), from mobile-drawer-items.json: the menu model the web sidebars use
// (@workspace/shared navigation-menu): sections of items nested up to MAX_DRAWER_DEPTH levels, each item
// shown only to sessions whose capabilities meet its requirement and whose feature flag is on. The
// requirements live here, by route, as compile-checked `PERMISSION.*` values mirroring the API route each
// screen loads (the admin sidebar's convention); the JSON stays plain. Everything the JSON names (routes,
// icons, sections, flags, depth) is checked when this module loads, so a typo fails at start-up instead of
// hiding an item. Two-factor authentication is reached through Security: its own route is an enrollment
// flow, not a settings page.

import { z } from "zod";

import {
	applyMenuAuthorization,
	compileMenu,
	filterCompiledSidebarMenu,
	PERMISSION,
	SidebarMenuDataSchema,
	type CapabilitySlug,
	type CompiledSidebarMenuData,
	type CompiledSidebarMenuItem,
	type CompiledSidebarMenuSection,
	type SidebarAuthorization,
	type SidebarMenuData,
} from "@workspace/shared";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import type { DrawerSectionTone } from "../../components/drawer-menu";
import { ROUTES, type AppRoute } from "../../runtime/routes";
import { APP_TABS, type AppTab } from "./app-tabs";
import { screenHeadingOf } from "./app-screens";
import { DRAWER_ICONS, DrawerIconNameSchema } from "./drawer-icons";
import drawerItemsJson from "./mobile-drawer-items.json";
import { DrawerSectionSchema, type DrawerSection, type NavigationLabels, type ScreenHeading } from "./navigation-labels";

/** The deepest an item may sit: a top-level item is level 1 (the web sidebars' nesting, ADR 038). */
export const MAX_DRAWER_DEPTH = 6;

/** Route → the capabilities its screen needs: the `@RequirePermission` of the API route it loads. */
export const MOBILE_DRAWER_AUTHORIZATION: ReadonlyMap<string, SidebarAuthorization> = new Map<string, SidebarAuthorization>([
	// GET /github/pull-requests… (READ GITHUB_PULL_REQUEST)
	[ROUTES.pullRequests, { permissions: [PERMISSION.GITHUB_PULL_REQUEST.READ] }],
	// GET /github/account (READ) · PUT + DELETE /github/account (UPDATE)
	[ROUTES.githubAccount, { permissions: [PERMISSION.GITHUB_PULL_REQUEST.READ, PERMISSION.GITHUB_PULL_REQUEST.UPDATE], mode: "all" }],
	// GET /operations/overview (LIST SERVER_METRIC)
	[ROUTES.servers, { permissions: [PERMISSION.SERVER_METRIC.LIST] }],
]);

/** The switches an item can wait on besides its capabilities (`featureFlag` in the JSON). */
export const DrawerFeatureFlagSchema = z.enum([
	// The UI kit gallery: a developer tool, listed in development builds only (its route redirects in a store build).
	"developer-tools",
	// GitHub pull requests (ADR 052): on unless the server has them off.
	"github-pull-requests",
]);

export type DrawerFeatureFlag = z.output<typeof DrawerFeatureFlagSchema>;

const ROUTE_VALUES: readonly AppRoute[] = Object.values(ROUTES);

/** An item's `url`: one of the app's routes, or "" for an item that only groups its children. */
const DrawerUrlSchema = z.union([z.literal("").transform((): null => null), z.enum(ROUTE_VALUES)]);

/** A section's `labelKey`: one of the titled sections, or `tabs` for the untitled block of tabs at the top. */
const DrawerSectionKeySchema = z.union([z.literal("tabs").transform((): null => null), DrawerSectionSchema]);

interface DrawerNodeBase {
	/** Stable and unique across the menu (compiled from the titles). */
	readonly id: string;
	/** Its English title, from the JSON: the label of a branch, which has no screen to name it. */
	readonly title: string;
	readonly labelKey: string;
	readonly icon: LucideIcon;
}

/** An entry that opens a screen. */
export interface DrawerScreen extends DrawerNodeBase {
	readonly kind: "screen";
	readonly route: AppRoute;
	/** A tab is switched to; any other screen is pushed onto its tab's stack. */
	readonly isTab: boolean;
}

/** An entry that folds open to show the entries under it (`url` "" in the JSON). */
export interface DrawerBranch extends DrawerNodeBase {
	readonly kind: "branch";
	readonly children: readonly DrawerNode[];
}

export type DrawerNode = DrawerScreen | DrawerBranch;

/** A titled group's name (in the language on screen, navigation-labels.ts) and the tint of its rows' tiles. */
export interface DrawerGroupHeading {
	readonly section: DrawerSection;
	readonly tone: DrawerSectionTone;
}

export interface DrawerGroup {
	readonly key: string;
	/** `null` for the tabs at the top: no title, neutral tiles. */
	readonly heading: DrawerGroupHeading | null;
	readonly nodes: readonly DrawerNode[];
}

/** Which items this session may see: its capabilities (`GET /auth/permissions`) and the flags that are on. */
export interface DrawerAccess {
	readonly capabilities: readonly CapabilitySlug[];
	readonly enabledFeatureFlags: readonly DrawerFeatureFlag[];
}

const TAB_ROUTES: ReadonlySet<string> = new Set(APP_TABS.map((tab: AppTab): string => tab.route));

/** Where the JSON is wrong, said once for every check made at load. */
function invalidMenu(problem: string): Error {
	return new Error(`mobile-drawer-items.json: ${problem}`);
}

function resolveNode(item: CompiledSidebarMenuItem, level: number): DrawerNode {
	if (level > MAX_DRAWER_DEPTH) {
		throw invalidMenu(`"${item.title}" sits at level ${String(level)}; the drawer nests up to ${String(MAX_DRAWER_DEPTH)}`);
	}
	if (item.featureFlag !== undefined) {
		DrawerFeatureFlagSchema.parse(item.featureFlag);
	}
	const base: DrawerNodeBase = { id: item.id, title: item.title, labelKey: item.labelKey, icon: DRAWER_ICONS[DrawerIconNameSchema.parse(item.icon)] };
	const route = DrawerUrlSchema.parse(item.url);
	const children = item.children ?? [];
	if (route === null) {
		if (children.length === 0) {
			throw invalidMenu(`"${item.title}" has no url and no children: a branch groups the entries under it`);
		}
		return { ...base, kind: "branch", children: children.map((child: CompiledSidebarMenuItem): DrawerNode => resolveNode(child, level + 1)) };
	}
	if (children.length > 0) {
		throw invalidMenu(`"${item.title}" opens a screen and has children: give a branch url "" and list the screen under it`);
	}
	return { ...base, kind: "screen", route, isTab: TAB_ROUTES.has(route) };
}

/**
 * A filtered item without the branches left empty: the filter keeps an authorized parent whose children
 * were all hidden (on the web it opens its own page), but a drawer branch has no screen of its own.
 */
function prunedItem(item: CompiledSidebarMenuItem): CompiledSidebarMenuItem | null {
	if (item.children === undefined || item.children.length === 0) {
		return item.url === "" ? null : item;
	}
	const children = item.children.map(prunedItem).filter((child: CompiledSidebarMenuItem | null): child is CompiledSidebarMenuItem => child !== null);
	return children.length === 0 ? null : { ...item, children };
}

function resolveGroup(section: CompiledSidebarMenuSection): DrawerGroup {
	const sectionKey = DrawerSectionKeySchema.parse(section.labelKey);
	const nodes = section.items.map((item: CompiledSidebarMenuItem): DrawerNode => resolveNode(item, 1));
	if (sectionKey === null) {
		return { key: section.key, heading: null, nodes };
	}
	if (section.color === undefined) {
		throw invalidMenu(`the "${section.title}" section needs a color: its rows' tiles take it`);
	}
	return { key: section.key, heading: { section: sectionKey, tone: section.color }, nodes };
}

/** A menu with every requirement applied and ids given, after checking all it names (throws where it is wrong). */
export function compileDrawerMenu(data: SidebarMenuData): CompiledSidebarMenuData {
	const menu = compileMenu(applyMenuAuthorization(data, MOBILE_DRAWER_AUTHORIZATION));
	menu.sections.forEach(resolveGroup);
	return menu;
}

/** The app's menu (mobile-drawer-items.json), checked as the module loads. */
export const DRAWER_MENU: CompiledSidebarMenuData = compileDrawerMenu(SidebarMenuDataSchema.parse(drawerItemsJson));

/** The groups this session sees, in order: the menu filtered by its capabilities and flags, empty sections dropped. */
export function drawerGroupsFor(access: DrawerAccess, menu: CompiledSidebarMenuData = DRAWER_MENU): readonly DrawerGroup[] {
	const filtered = filterCompiledSidebarMenu(menu, access.capabilities, { enabledFeatureFlags: access.enabledFeatureFlags });
	return filtered.sections
		.map((section: CompiledSidebarMenuSection): CompiledSidebarMenuSection => ({
			...section,
			items: section.items.map(prunedItem).filter((item: CompiledSidebarMenuItem | null): item is CompiledSidebarMenuItem => item !== null),
		}))
		.filter((section: CompiledSidebarMenuSection): boolean => section.items.length > 0)
		.map(resolveGroup);
}

/** What turns the flags on: whether this is a development build (`__DEV__`), and whether the server has pull requests on. */
export interface DrawerFeatureSwitches {
	readonly developmentBuild: boolean;
	readonly githubPullRequests: boolean;
}

/** The flags that are on: the developer tools in a development build, pull requests unless the server has them off. */
export function enabledDrawerFeatureFlags({ developmentBuild, githubPullRequests }: DrawerFeatureSwitches): readonly DrawerFeatureFlag[] {
	const flags: DrawerFeatureFlag[] = [];
	if (developmentBuild) {
		flags.push("developer-tools");
	}
	if (githubPullRequests) {
		flags.push("github-pull-requests");
	}
	return flags;
}

/** The screens a group opens, branches unfolded in order (the command palette's list). */
export function destinationsOf(nodes: readonly DrawerNode[]): readonly DrawerScreen[] {
	return nodes.flatMap((node: DrawerNode): readonly DrawerScreen[] => (node.kind === "branch" ? destinationsOf(node.children) : [node]));
}

/** Whether `node` is, or holds at any depth, the entry that opens `pathname`: a branch holding the screen on show starts folded open. */
export function holdsScreen(node: DrawerNode, pathname: string): boolean {
	return node.kind === "screen" ? node.route === pathname : node.children.some((child: DrawerNode): boolean => holdsScreen(child, pathname));
}

/** An entry's label and line, in the language on screen: its screen's heading, or a branch's own title. */
export function drawerHeadingOf(node: DrawerNode, labels: NavigationLabels): ScreenHeading {
	const heading = node.kind === "screen" ? screenHeadingOf(node.route, {}, labels) : null;
	return heading === null || heading.title === "" ? { title: node.title, subtitle: "" } : heading;
}

/** The edge swipe opens the drawer only on a tab's first screen: deeper in, it means "back". */
export function isTabRoot(pathname: string): boolean {
	return TAB_ROUTES.has(pathname);
}
