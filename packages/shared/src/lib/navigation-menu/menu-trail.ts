// The breadcrumb trail of a page, read from the navigation menu every app shares (the web sidebars, the
// mobile drawer): the deepest menu entry that is the page or one of its ancestors anchors the trail, the
// section it sits in may lead it, and the URL segments below the entry follow. Generic over the crumbs'
// icon (a lucide-react component on the web, a lucide-react-native one on the phone), framework-free, so
// every app resolves its trail the same way.

import {
	findDeepestNavMatch,
	GROUPING_NODE_URL,
	longestSharedSegmentPrefix,
	normalizePath,
	segmentsOfPath,
	sharesPathSegmentRoot,
	updateLastTrailItem,
	type NavTreeMatch,
	type NavTreeShape,
} from "./breadcrumb-tree";

/** One crumb: its label, a link (none on the page on show) and its icon. */
export interface MenuTrailCrumb<TIcon> {
	readonly label: string;
	readonly href?: string | undefined;
	readonly icon: TIcon;
}

/** Maps a menu URL to the app's href (a base path, a locale prefix). */
export type MenuTrailResolveHref = (menuUrl: string) => string;

/** A menu URL as it is. */
export function identityMenuTrailHref(menuUrl: string): string {
	return menuUrl;
}

export interface SidebarMenuTrailNode {
	readonly title: string;
	readonly url: string;
	readonly icon?: string | undefined;
	readonly children?: readonly SidebarMenuTrailNode[] | undefined;
}

export interface SidebarMenuTrailSection {
	/** What the section is called on screen (in the reader's language). */
	readonly title: string;
	/** Its stable identity (the English title), the same in every language; defaults to the title. */
	readonly key?: string | undefined;
	readonly items: readonly SidebarMenuTrailNode[];
}

export interface SidebarMenuTrailData {
	readonly sections: readonly SidebarMenuTrailSection[];
	readonly bottomItems: readonly SidebarMenuTrailNode[];
}

/** What an app knows about one of its pages that has no menu entry. */
export interface SidebarTrailPage {
	/** Crumb label — e.g. a generic "Reward" for a detail page whose title loads later. Omitted → humanized URL segment. */
	readonly label?: string | undefined;
}

/**
 * Classifies a pathname below the deepest menu match: a page (optionally
 * labelled) or `null` when no page lives at that URL.
 */
export type SidebarTrailPageResolver = (pathname: string) => SidebarTrailPage | null;

export interface ResolveMenuTrailConfig<TIcon> {
	readonly menu: SidebarMenuTrailData;
	readonly pathname: string;
	readonly resolveIcon: (iconName: string | undefined) => TIcon;
	readonly resolveHref?: MenuTrailResolveHref | undefined;
	readonly rootCurrentLabel: string;
	readonly rootIcon: TIcon;
	/** The icon of a crumb for a page with no menu entry (a URL segment, a renamed tail). */
	readonly pageIcon: TIcon;
	readonly unknownFallbackLabel: string;
	/**
	 * Prepend the section title as a context crumb (`Platform › Catalog`) for
	 * items of multi-item sections. Default `true`. Apps whose sections are
	 * mere groupings of single pages turn it off so the trail starts at the page.
	 */
	readonly includeSectionContext?: boolean | undefined;
	/** The stable key of the catch-all section, whose items never get a section crumb. Default "Main" (the web sidebars); the mobile drawer's is "Tabs". */
	readonly catchAllSectionKey?: string | undefined;
	/**
	 * Describes the app's pages for URL segments past the deepest menu match.
	 * When given, an intermediate segment that is not a page
	 * (`/dashboard/rewards` in `/dashboard/rewards/42`) produces no crumb, one
	 * that is a page becomes a linked crumb, and a page's `label` replaces the
	 * humanized segment. Omitted → every remaining segment becomes an unlinked,
	 * humanized crumb.
	 */
	readonly resolvePage?: SidebarTrailPageResolver | undefined;
}

function labelFromSegment(segment: string): string {
	const words = segment.replace(/[-_]+/g, " ").trim();
	return words.length > 0 ? words.replace(/\b\w/g, (char) => char.toUpperCase()) : segment;
}

function getSidebarChildren(item: SidebarMenuTrailNode): readonly SidebarMenuTrailNode[] {
	return item.children ?? [];
}

/** Every top-level menu item, sections first, with the section it sits in (`null` for bottom items). */
interface SidebarMenuRoots {
	readonly roots: readonly SidebarMenuTrailNode[];
	readonly sectionOf: ReadonlyMap<SidebarMenuTrailNode, SidebarMenuTrailSection>;
}

function collectMenuRoots(menu: SidebarMenuTrailData): SidebarMenuRoots {
	const roots: SidebarMenuTrailNode[] = [];
	const sectionOf = new Map<SidebarMenuTrailNode, SidebarMenuTrailSection>();
	for (const section of menu.sections) {
		for (const item of section.items) {
			roots.push(item);
			if (!sectionOf.has(item)) {
				sectionOf.set(item, section);
			}
		}
	}
	roots.push(...menu.bottomItems);
	return { roots, sectionOf };
}

/** The catch-all section, whose items never get a section crumb (by its stable key: its title is translated). */
export const DEFAULT_CATCH_ALL_SECTION_KEY = "Main";

/**
 * `Section ›` context crumb in front of an item of a multi-item section (never the `Main` catch-all). An item
 * named like its section on screen gets none either, so a trail never reads "Rewards › Rewards".
 */
function shouldPrependSectionTitle(section: SidebarMenuTrailSection, item: SidebarMenuTrailNode, catchAllSectionKey: string): boolean {
	return section.items.length > 1 && item.title !== section.title && (section.key ?? section.title) !== catchAllSectionKey;
}

/**
 * Crumbs for the segments of `pathname` from index `startIndex` on — the part
 * of the URL no menu item covers. See `ResolveSidebarMenuTrailConfig.resolvePage`.
 */
function segmentCrumbs<TIcon>(pathname: string, startIndex: number, resolvePage: SidebarTrailPageResolver | undefined, pageIcon: TIcon): readonly MenuTrailCrumb<TIcon>[] {
	const segments = segmentsOfPath(pathname);
	const crumbs: MenuTrailCrumb<TIcon>[] = [];
	for (let index = startIndex; index < segments.length; index += 1) {
		const segment = segments[index];
		if (segment === undefined) {
			continue;
		}
		if (resolvePage === undefined) {
			crumbs.push({ label: labelFromSegment(segment), icon: pageIcon });
			continue;
		}
		const path = `/${segments.slice(0, index + 1).join("/")}`;
		const page = resolvePage(path);
		const isCurrent = index === segments.length - 1;
		if (page === null && !isCurrent) {
			continue;
		}
		const label = page?.label ?? labelFromSegment(segment);
		crumbs.push(isCurrent ? { label, icon: pageIcon } : { label, href: path, icon: pageIcon });
	}
	return crumbs;
}

/**
 * Replaces the label on the final crumb — for data-driven pages whose entity
 * name is only known at runtime.
 */
export function withMenuTrailTailLabel<TIcon>(trail: readonly MenuTrailCrumb<TIcon>[], label: string, pageIcon: TIcon): readonly MenuTrailCrumb<TIcon>[] {
	if (trail.length === 0) {
		return [{ label, icon: pageIcon }];
	}
	return updateLastTrailItem(trail, (last) => ({ label, icon: last.icon }));
}

interface TrailContext<TIcon> {
	readonly pathname: string;
	readonly resolveIcon: (iconName: string | undefined) => TIcon;
	readonly pageIcon: TIcon;
	readonly resolveHref: MenuTrailResolveHref;
	readonly includeSectionContext: boolean;
	readonly catchAllSectionKey: string;
	readonly resolvePage: SidebarTrailPageResolver | undefined;
	readonly sectionOf: ReadonlyMap<SidebarMenuTrailNode, SidebarMenuTrailSection>;
}

/** The section crumb for `root`, when this app shows section context and `root` sits in a multi-item section. */
function sectionCrumbs<TIcon>(root: SidebarMenuTrailNode, context: TrailContext<TIcon>): readonly MenuTrailCrumb<TIcon>[] {
	const section = context.sectionOf.get(root);
	if (!context.includeSectionContext || section === undefined || !shouldPrependSectionTitle(section, root, context.catchAllSectionKey)) {
		return [];
	}
	return [{ label: section.title, icon: context.resolveIcon(root.icon) }];
}

/**
 * The trail for a menu match: section context, then every node of the chain
 * as a linked crumb, then the segments below an ancestor match. An exact match
 * ends on an unlinked current-page crumb — except a top-level item shown
 * under its section crumb, which stays a link to its page.
 */
function trailForMatch<TIcon>(root: SidebarMenuTrailNode, match: NavTreeMatch<SidebarMenuTrailNode>, context: TrailContext<TIcon>): readonly MenuTrailCrumb<TIcon>[] {
	const section = sectionCrumbs(root, context);
	const crumbs: MenuTrailCrumb<TIcon>[] = match.chain.map((node): MenuTrailCrumb<TIcon> => ({
		label: node.title,
		// A grouping (no URL of its own) names where the page sits, but has no page to open.
		href: node.url === GROUPING_NODE_URL ? undefined : context.resolveHref(node.url),
		icon: context.resolveIcon(node.icon),
	}));
	if (match.kind === "ancestor") {
		return [...section, ...crumbs, ...segmentCrumbs(context.pathname, segmentsOfPath(match.url).length, context.resolvePage, context.pageIcon)];
	}
	const keepsSelfLink = section.length > 0 && match.chain.length === 1;
	const trail = keepsSelfLink ? crumbs : updateLastTrailItem(crumbs, (last): MenuTrailCrumb<TIcon> => ({ label: last.label, icon: last.icon }));
	return [...section, ...trail];
}

/**
 * Builds a breadcrumb trail for a pathname by walking a compiled sidebar menu.
 * Returns crumbs with mandatory icons; the final crumb has no `href`.
 *
 * 1. The deepest menu item that is the page or one of its ancestors anchors
 *    the trail (`findDeepestNavMatch`) — leaf or branch, at any depth.
 * 2. Only when no menu URL covers the page, a top-level branch sharing its
 *    first URL segment does (last resort: a page of an app whose menu entry
 *    points at a sub-page, like `/reports/overview` for `/reports/archive`).
 * 3. Otherwise the root crumb (`/`) or the unknown-page fallback.
 */
export function resolveMenuTrail<TIcon>(config: ResolveMenuTrailConfig<TIcon>): readonly MenuTrailCrumb<TIcon>[] {
	const {
		menu,
		pathname,
		resolveIcon,
		resolveHref = identityMenuTrailHref,
		rootCurrentLabel,
		rootIcon,
		pageIcon,
		unknownFallbackLabel,
		includeSectionContext = true,
		catchAllSectionKey = DEFAULT_CATCH_ALL_SECTION_KEY,
		resolvePage,
	} = config;
	const normalizedPath = normalizePath(pathname);
	const { roots, sectionOf } = collectMenuRoots(menu);
	const shape: NavTreeShape<SidebarMenuTrailNode> = { getUrl: (node: SidebarMenuTrailNode): string => resolveHref(node.url), getChildren: getSidebarChildren };
	const context: TrailContext<TIcon> = { pathname: normalizedPath, resolveIcon, pageIcon, resolveHref, includeSectionContext, catchAllSectionKey, resolvePage, sectionOf };

	const match = findDeepestNavMatch(roots, normalizedPath, shape);
	const matchedRoot = match?.chain.at(0);
	if (match !== null && matchedRoot !== undefined) {
		return trailForMatch(matchedRoot, match, context);
	}

	const segmentRoot = roots.find((root) => sectionOf.has(root) && getSidebarChildren(root).length > 0 && sharesPathSegmentRoot(shape.getUrl(root), normalizedPath));
	if (segmentRoot !== undefined) {
		const rootUrl = shape.getUrl(segmentRoot);
		return [
			...sectionCrumbs(segmentRoot, context),
			{ label: segmentRoot.title, href: rootUrl, icon: resolveIcon(segmentRoot.icon) },
			...segmentCrumbs(normalizedPath, longestSharedSegmentPrefix(normalizedPath, rootUrl), resolvePage, pageIcon),
		];
	}

	if (normalizedPath === "/") {
		return [{ label: rootCurrentLabel, icon: rootIcon }];
	}
	return [{ label: unknownFallbackLabel, href: "/", icon: rootIcon }];
}
