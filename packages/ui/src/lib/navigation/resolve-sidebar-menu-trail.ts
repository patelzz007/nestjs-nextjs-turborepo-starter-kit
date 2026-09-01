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
} from "@workspace/ui/lib/navigation/breadcrumb-tree";
import { FileText, type LucideIcon } from "lucide-react";

export interface SidebarMenuTrailNode {
	readonly title: string;
	readonly url: string;
	readonly icon?: string;
	readonly children?: readonly SidebarMenuTrailNode[];
}

export interface SidebarMenuTrailSection {
	readonly title: string;
	readonly items: readonly SidebarMenuTrailNode[];
}

export interface SidebarMenuTrailData {
	readonly sections: readonly SidebarMenuTrailSection[];
	readonly bottomItems: readonly SidebarMenuTrailNode[];
}

export interface ResolveSidebarMenuTrailConfig {
	readonly menu: SidebarMenuTrailData;
	readonly pathname: string;
	readonly resolveIcon: (iconName: string | undefined) => LucideIcon;
	readonly rootCurrentLabel: string;
	readonly rootIcon: LucideIcon;
	readonly unknownFallbackLabel: string;
}

function labelFromSegment(segment: string): string {
	const words = segment.replace(/[-_]+/g, " ").trim();
	return words.length > 0 ? words.replace(/\b\w/g, (char) => char.toUpperCase()) : segment;
}

function getSidebarChildren(item: SidebarMenuTrailNode): readonly SidebarMenuTrailNode[] {
	return item.children ?? [];
}

function createNavAdapter(resolveIcon: (iconName: string | undefined) => LucideIcon): NavTreeAdapter<SidebarMenuTrailNode> {
	return {
		getUrl: (node: SidebarMenuTrailNode): string => node.url,
		getChildren: getSidebarChildren,
		toLinkedCrumb: (node: SidebarMenuTrailNode): BreadcrumbItem => ({
			label: node.title,
			href: node.url,
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
): readonly BreadcrumbItem[] {
	if (!shouldPrependSectionTitle(section, item)) {
		return trail;
	}
	return [{ label: section.title, icon: resolveIcon(item.icon) }, ...trail];
}

function appendUnresolvedSegments(
	pathname: string,
	trail: BreadcrumbItem[],
	flatNodes: readonly SidebarMenuTrailNode[],
	adapter: NavTreeAdapter<SidebarMenuTrailNode>,
): readonly BreadcrumbItem[] {
	const prefixLength = bestSharedSegmentPrefix(pathname, flatNodes, adapter.getUrl);
	const remaining = segmentsOfPath(pathname).slice(prefixLength);
	for (const segment of remaining) {
		trail.push({ label: labelFromSegment(segment), icon: FileText });
	}
	return trail;
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
	const { menu, pathname, resolveIcon, rootCurrentLabel, rootIcon, unknownFallbackLabel } = config;
	const normalizedPath = normalizePath(pathname);
	const snapshot = createSidebarMenuSnapshot(menu);
	const adapter = createNavAdapter(resolveIcon);
	const trail: BreadcrumbItem[] = [];

	for (const section of menu.sections) {
		for (const item of section.items) {
			const icon = resolveIcon(item.icon);
			if (item.url === normalizedPath) {
				if (shouldPrependSectionTitle(section, item)) {
					return [
						{ label: section.title, icon },
						{ label: item.title, href: item.url, icon },
					];
				}
				return [{ label: item.title, icon }];
			}
			const children = item.children;
			if (children !== undefined && (isPathAncestor(item.url, normalizedPath) || sharesPathSegmentRoot(item.url, normalizedPath))) {
				const sectionTrail: BreadcrumbItem[] = [adapter.toLinkedCrumb(item)];
				if (walkNavTreeForPath(children, normalizedPath, sectionTrail, adapter)) {
					return appendUnresolvedSegments(normalizedPath, [...withSectionContext(section, item, sectionTrail, resolveIcon)], snapshot.flatNodes, adapter);
				}
				if (sharesPathSegmentRoot(item.url, normalizedPath)) {
					return appendUnresolvedSegments(normalizedPath, [...withSectionContext(section, item, sectionTrail, resolveIcon)], snapshot.flatNodes, adapter);
				}
			}
		}
	}

	if (walkNavTreeForPath(menu.bottomItems, normalizedPath, trail, adapter)) {
		return appendUnresolvedSegments(normalizedPath, trail, snapshot.flatNodes, adapter);
	}

	const segments = segmentsOfPath(normalizedPath);
	for (let keep = segments.length - 1; keep >= 1; keep -= 1) {
		const prefix = `/${segments.slice(0, keep).join("/")}`;
		const prefixTrail: BreadcrumbItem[] = [];
		if (walkNavTreeForPath(snapshot.roots, prefix, prefixTrail, adapter, { asParent: true })) {
			const remaining = segments.slice(keep);
			for (const segment of remaining) {
				prefixTrail.push({ label: labelFromSegment(segment), icon: FileText });
			}
			return prefixTrail;
		}
	}

	if (normalizedPath === "/") {
		return [{ label: rootCurrentLabel, icon: rootIcon }];
	}
	return [{ label: unknownFallbackLabel, href: "/", icon: rootIcon }];
}
