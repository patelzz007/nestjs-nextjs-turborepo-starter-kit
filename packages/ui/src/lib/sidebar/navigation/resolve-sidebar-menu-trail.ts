import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";
import {
	bestSharedSegmentPrefix,
	flattenNavTree,
	isPathAncestor,
	normalizePath,
	segmentsOfPath,
	sharesPathSegmentRoot,
	type NavTreeAdapter,
	updateLastTrailItem,
	walkNavTreeForPath,
} from "@workspace/ui/lib/sidebar/navigation/breadcrumb-tree";
import { identitySidebarResolveHref, type SidebarResolveHref } from "@workspace/ui/lib/sidebar/resolve-menu-hrefs";
import { FileText, type LucideIcon } from "lucide-react";

export interface SidebarMenuTrailNode {
	readonly title: string;
	readonly url: string;
	readonly icon?: string | undefined;
	readonly children?: readonly SidebarMenuTrailNode[] | undefined;
}

export interface SidebarMenuTrailSection {
	readonly title: string;
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

export interface ResolveSidebarMenuTrailConfig {
	readonly menu: SidebarMenuTrailData;
	readonly pathname: string;
	readonly resolveIcon: (iconName: string | undefined) => LucideIcon;
	readonly resolveHref?: SidebarResolveHref;
	readonly rootCurrentLabel: string;
	readonly rootIcon: LucideIcon;
	readonly unknownFallbackLabel: string;
	/**
	 * Prepend the section title as a context crumb (`Platform › Catalog`) for
	 * items of multi-item sections. Default `true`. Apps whose sections are
	 * mere groupings of single pages turn it off so the trail starts at the page.
	 */
	readonly includeSectionContext?: boolean | undefined;
	/**
	 * Describes the app's pages for URL segments past the deepest menu match.
	 * When given, an intermediate segment that is not a page
	 * (`/rewardhub/rewards` in `/rewardhub/rewards/42`) produces no crumb, one
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

function createNavAdapter(resolveIcon: (iconName: string | undefined) => LucideIcon, resolveHref: SidebarResolveHref): NavTreeAdapter<SidebarMenuTrailNode> {
	return {
		getUrl: (node: SidebarMenuTrailNode): string => resolveHref(node.url),
		getChildren: getSidebarChildren,
		toLinkedCrumb: (node: SidebarMenuTrailNode): BreadcrumbItem => ({
			label: node.title,
			href: resolveHref(node.url),
			icon: resolveIcon(node.icon),
		}),
		toCurrentCrumb: (node: SidebarMenuTrailNode): BreadcrumbItem => ({
			label: node.title,
			icon: resolveIcon(node.icon),
		}),
	};
}

interface SidebarMenuSnapshot {
	readonly roots: readonly SidebarMenuTrailNode[];
	readonly flatNodes: readonly SidebarMenuTrailNode[];
}

function createSidebarMenuSnapshot(menu: SidebarMenuTrailData): SidebarMenuSnapshot {
	const roots: SidebarMenuTrailNode[] = [];
	for (const section of menu.sections) {
		for (const item of section.items) {
			roots.push(item);
		}
	}
	for (const item of menu.bottomItems) {
		roots.push(item);
	}
	return {
		roots,
		flatNodes: flattenNavTree(roots, getSidebarChildren),
	};
}

function shouldPrependSectionTitle(section: SidebarMenuTrailSection, item: SidebarMenuTrailNode): boolean {
	return section.items.length > 1 && item.title !== section.title && section.title !== "Main";
}

function withSectionContext(
	section: SidebarMenuTrailSection,
	item: SidebarMenuTrailNode,
	trail: readonly BreadcrumbItem[],
	resolveIcon: (iconName: string | undefined) => LucideIcon,
	includeSectionContext: boolean,
): readonly BreadcrumbItem[] {
	if (!includeSectionContext || !shouldPrependSectionTitle(section, item)) {
		return trail;
	}
	return [{ label: section.title, icon: resolveIcon(item.icon) }, ...trail];
}

/**
 * Crumbs for the segments of `pathname` from index `startIndex` on — the part
 * of the URL no menu item covers. See `ResolveSidebarMenuTrailConfig.resolvePage`.
 */
function segmentCrumbs(pathname: string, startIndex: number, resolvePage: SidebarTrailPageResolver | undefined): readonly BreadcrumbItem[] {
	const segments = segmentsOfPath(pathname);
	const crumbs: BreadcrumbItem[] = [];
	for (let index = startIndex; index < segments.length; index += 1) {
		const segment = segments[index];
		if (segment === undefined) {
			continue;
		}
		if (resolvePage === undefined) {
			crumbs.push({ label: labelFromSegment(segment), icon: FileText });
			continue;
		}
		const path = `/${segments.slice(0, index + 1).join("/")}`;
		const page = resolvePage(path);
		const isCurrent = index === segments.length - 1;
		if (page === null && !isCurrent) {
			continue;
		}
		const label = page?.label ?? labelFromSegment(segment);
		crumbs.push(isCurrent ? { label, icon: FileText } : { label, href: path, icon: FileText });
	}
	return crumbs;
}

function appendUnresolvedSegments(
	pathname: string,
	trail: readonly BreadcrumbItem[],
	flatNodes: readonly SidebarMenuTrailNode[],
	adapter: NavTreeAdapter<SidebarMenuTrailNode>,
	resolvePage: SidebarTrailPageResolver | undefined,
): readonly BreadcrumbItem[] {
	const prefixLength = bestSharedSegmentPrefix(pathname, flatNodes, adapter.getUrl);
	return [...trail, ...segmentCrumbs(pathname, prefixLength, resolvePage)];
}

/** True when some menu item's URL is `pathname` or one of its ancestors. O(n · d). */
function hasMenuAncestor(pathname: string, flatNodes: readonly SidebarMenuTrailNode[], adapter: NavTreeAdapter<SidebarMenuTrailNode>): boolean {
	return flatNodes.some((node) => isPathAncestor(adapter.getUrl(node), pathname));
}

/**
 * Replaces the label on the final crumb — for data-driven pages whose entity
 * name is only known at runtime.
 */
export function withTrailTailLabel(trail: readonly BreadcrumbItem[], label: string): readonly BreadcrumbItem[] {
	if (trail.length === 0) {
		return [{ label, icon: FileText }];
	}
	return updateLastTrailItem(trail, (last) => ({ label, icon: last.icon }));
}

/**
 * Builds a breadcrumb trail for a pathname by walking a compiled sidebar menu.
 * Returns crumbs with mandatory icons; the final crumb has no `href`.
 */
export function resolveSidebarMenuTrail(config: ResolveSidebarMenuTrailConfig): readonly BreadcrumbItem[] {
	const {
		menu,
		pathname,
		resolveIcon,
		resolveHref = identitySidebarResolveHref,
		rootCurrentLabel,
		rootIcon,
		unknownFallbackLabel,
		includeSectionContext = true,
		resolvePage,
	} = config;
	const normalizedPath = normalizePath(pathname);
	const snapshot = createSidebarMenuSnapshot(menu);
	const adapter = createNavAdapter(resolveIcon, resolveHref);
	const trail: BreadcrumbItem[] = [];
	// Matching a section on its first URL segment alone is a last resort: when
	// a real ancestor exists in the menu (e.g. every page of an app sits under
	// one base segment), an unrelated parent sharing that segment must not
	// capture the trail.
	const allowSegmentRootMatch = !hasMenuAncestor(normalizedPath, snapshot.flatNodes, adapter);

	for (const section of menu.sections) {
		for (const item of section.items) {
			const icon = resolveIcon(item.icon);
			const itemHref = adapter.getUrl(item);
			if (itemHref === normalizedPath) {
				if (includeSectionContext && shouldPrependSectionTitle(section, item)) {
					return [
						{ label: section.title, icon },
						{ label: item.title, href: itemHref, icon },
					];
				}
				return [{ label: item.title, icon }];
			}
			const children = item.children;
			if (children !== undefined && (isPathAncestor(itemHref, normalizedPath) || (allowSegmentRootMatch && sharesPathSegmentRoot(itemHref, normalizedPath)))) {
				const sectionTrail: BreadcrumbItem[] = [adapter.toLinkedCrumb(item)];
				if (walkNavTreeForPath(children, normalizedPath, sectionTrail, adapter)) {
					return appendUnresolvedSegments(
						normalizedPath,
						withSectionContext(section, item, sectionTrail, resolveIcon, includeSectionContext),
						snapshot.flatNodes,
						adapter,
						resolvePage,
					);
				}
				if (sharesPathSegmentRoot(itemHref, normalizedPath)) {
					return appendUnresolvedSegments(
						normalizedPath,
						withSectionContext(section, item, sectionTrail, resolveIcon, includeSectionContext),
						snapshot.flatNodes,
						adapter,
						resolvePage,
					);
				}
			}
		}
	}

	if (walkNavTreeForPath(menu.bottomItems, normalizedPath, trail, adapter)) {
		return appendUnresolvedSegments(normalizedPath, trail, snapshot.flatNodes, adapter, resolvePage);
	}

	const segments = segmentsOfPath(normalizedPath);
	for (let keep = segments.length - 1; keep >= 1; keep -= 1) {
		const prefix = `/${segments.slice(0, keep).join("/")}`;
		const prefixTrail: BreadcrumbItem[] = [];
		if (walkNavTreeForPath(snapshot.roots, prefix, prefixTrail, adapter, { asParent: true })) {
			return [...prefixTrail, ...segmentCrumbs(normalizedPath, keep, resolvePage)];
		}
	}

	if (normalizedPath === "/") {
		return [{ label: rootCurrentLabel, icon: rootIcon }];
	}
	return [{ label: unknownFallbackLabel, href: "/", icon: rootIcon }];
}
